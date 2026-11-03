import { Directory, File, Paths } from "expo-file-system";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { api, ApiError } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { pace, useLight } from "@/lib/light";
import { isNetworkError, isOnline, onReconnect } from "@/lib/network";
import { notifyReady } from "@/lib/notify";
import { postStream } from "@/lib/sse";
import type { CheckResult, Me, Origin } from "@/lib/types";
import { MAX_BYTES, normalise, uploadFile, waitReady } from "@/lib/upload";
import { useWorkspace } from "@/lib/workspace";
import { keepAlive, letGo } from "../../modules/checky-text";

/** "À envoyer": what a journalist captures without a network (a shared video, a photo, a link, a
 * new claim) is kept on the phone and sent when the network comes back. The same queue runs the
 * checks sent to the background (« Continuer en arrière-plan ») and batches of screenshots; those
 * end with a local notification.
 *
 * The queue lives at module level, not in React: the background task (`lib/background.ts`) runs
 * it with no screen mounted, after Android restarted the app on its own. While checks run in the
 * background a foreground service (`keepAlive`) stops Android from freezing the app.
 * Files are copied into the app's own folder so a cleared share cache does not lose them.
 * Only in-app actions add entries (never a deep link), like `handoff.ts`. */

export type QueuedFile = { uri: string; mime: string; name: string; size?: number | null };
export type QueuedCheck = { url?: string; text?: string; file?: QueuedFile };
export type EntryState = "waiting" | "sending" | "done" | "failed";

export type Entry = {
  id: string;
  user: string;
  ws: string;
  at: string;
  kind: "check" | "claim";
  check?: QueuedCheck;
  claim?: { title: string; origin: Origin };
  state: EntryState;
  tries: number;
  /** Not before this time (ms), after a failure while online. */
  nextAt?: number;
  /** Set once the file is uploaded, so a retry does not upload it again. */
  sourceId?: string;
  result?: CheckResult;
  itemId?: string;
  /** A `t.outbox.errors` key. */
  error?: string;
  /** Sent to the background: a notification says when it is ready. */
  notify?: boolean;
  notified?: boolean;
  /** Screenshots shared together (`/lot`). */
  batch?: string;
  /** What the uploaded file is, to group a batch by rumour (`lib/group.ts`). */
  sha256?: string | null;
  dhash?: string | null;
};

export type NewEntry =
  | { kind: "check"; check: QueuedCheck; sourceId?: string; notify?: boolean; batch?: string }
  | { kind: "claim"; claim: { title: string; origin: Origin } };

type Ctx = {
  /** The signed-in journalist's entries in the current newsroom, oldest first. */
  entries: Entry[];
  progress: Record<string, number>;
  add: (e: NewEntry) => string;
  remove: (id: string) => void;
  retry: (id: string) => void;
  /** Sign-out: everything queued on this phone goes. */
  clear: () => void;
};

const DIR = new Directory(Paths.document, "outbox");
const INDEX = new File(DIR, "index.json");

function load(): Entry[] {
  try {
    return INDEX.exists ? (JSON.parse(INDEX.textSync()) as Entry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: Entry[]) {
  try {
    DIR.create({ idempotent: true, intermediates: true });
    INDEX.writeSync(JSON.stringify(entries));
  } catch {
    // kept in memory for this session at least
  }
}

// --- the store, at module level: shared by the screens and the background task

let all: Entry[] = load();
let progress: Record<string, number> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};

function commit(next: Entry[]) {
  all = next;
  persist(next);
  emit();
}

const update = (id: string, patch: Partial<Entry>) => commit(all.map((e) => (e.id === id ? { ...e, ...patch } : e)));

function setProgress(id: string, share: number | null) {
  const { [id]: _, ...rest } = progress;
  progress = share === null ? rest : { ...rest, [id]: share };
  emit();
}

/** Copy into the outbox folder; if that fails the original path is kept. */
function keep(id: string, f: QueuedFile): QueuedFile {
  const file = normalise(f);
  try {
    DIR.create({ idempotent: true, intermediates: true });
    const ext = /\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1] ?? file.mime.split("/")[1] ?? "bin";
    const dest = new File(DIR, `${id}.${ext}`);
    new File(file.uri).copySync(dest);
    return { ...file, uri: dest.uri, size: file.size ?? dest.size };
  } catch {
    return file;
  }
}

function drop(e: Entry | undefined) {
  const uri = e?.check?.file?.uri;
  if (!uri || !uri.startsWith(DIR.uri)) return;
  try {
    new File(uri).delete();
  } catch {
    // already gone
  }
}

/** Failures worth trying again later: no network, server busy or down, an expired sign-in. */
function transient(e: unknown): boolean {
  if (isNetworkError(e)) return true;
  if (!(e instanceof ApiError)) return true;
  return e.status === 0 || e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500 || e.code === "ai_unavailable";
}

function errorKey(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "";
  return code === "too_large" ? "tooLarge" : code === "unsupported_type" ? "unsupported" : code === "source_failed" ? "sourceFailed" : "failed";
}

async function send(e: Entry): Promise<Partial<Entry>> {
  if (e.kind === "claim" && e.claim) {
    const made = await api<{ item_id: string }>(`/workspaces/${e.ws}/copilot/act`, {
      method: "POST",
      body: JSON.stringify({ kind: "create_claim", title: e.claim.title, origin: e.claim.origin }),
    });
    return { itemId: made.item_id };
  }
  const check = e.check ?? {};
  let sourceId = e.sourceId;
  const found: Partial<Entry> = {};
  if (check.file && !sourceId) {
    const src = await uploadFile(e.ws, check.file, (share) => setProgress(e.id, share));
    sourceId = src.id;
    update(e.id, { sourceId });
  }
  if (sourceId) {
    const ready = await waitReady(e.ws, sourceId);
    found.sha256 = ready.file?.sha256 ?? null;
    const dhash = (ready.file?.meta as { dhash?: unknown } | undefined)?.dhash;
    found.dhash = typeof dhash === "string" ? dhash : null;
  }
  const body = sourceId ? { source_id: sourceId } : { url: check.url || undefined, text: check.text || undefined };
  let result: CheckResult | null = null;
  let failed: string | null = null;
  // A stream that stalls would hold up the whole queue.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5 * 60_000);
  try {
    await postStream(
      `/workspaces/${e.ws}/link-check`,
      body,
      (event, data) => {
        if (event === "result") result = data as CheckResult;
        else if (event === "error") failed = (data as { code?: string }).code ?? "failed";
      },
      ctrl.signal,
    );
  } finally {
    clearTimeout(timer);
  }
  if (failed) throw new ApiError(failed === "ai_unavailable" ? 503 : 422, failed, failed);
  if (!result) throw new ApiError(502, "no_result", "No result");
  return { ...found, result };
}

const pending = (e: Entry) => e.state === "waiting" || e.state === "sending";

/** « Vérification prête »: once per check, or once per batch when its last screenshot is done.
 * Only while the app is not on screen; the reading is named as a reading. */
async function announce(e: Entry) {
  const t = tr();
  if (!e.notify || e.notified || AppState.currentState === "active") return;
  if (e.batch) {
    const batch = all.filter((x) => x.batch === e.batch);
    if (batch.some(pending) || batch.some((x) => x.notified)) return;
    batch.forEach((x) => update(x.id, { notified: true }));
    const done = batch.filter((x) => x.state === "done").length;
    await notifyReady(t.background.readyNoVerdict, t.batch.progress(done, batch.length), { batch: e.batch });
    return;
  }
  update(e.id, { notified: true });
  if (e.state === "failed") return notifyReady(t.background.failed, e.check?.url ?? e.check?.file?.name ?? "", { entry: e.id });
  const verdict = e.result?.analysis?.verdict;
  const title = verdict ? t.background.ready(t.verdict[verdict] ?? verdict) : t.background.readyNoVerdict;
  const about = e.result?.claims?.[0] ?? e.result?.title ?? e.check?.url ?? e.check?.text ?? "";
  await notifyReady(title, about.slice(0, 160), { entry: e.id });
}

let running = false;
/** Whose entries to send: the signed-in journalist (set by the provider, or read from /me by the
 * background task when no screen is mounted). */
let activeUser: string | null = null;

async function whoAmI(): Promise<string | null> {
  if (activeUser) return activeUser;
  try {
    activeUser = (await api<Me>("/me")).id;
  } catch {
    // signed out or offline: nothing is sent
  }
  return activeUser;
}

/** True while something still has to be sent. */
export const hasPending = () => all.some(pending);

/** Sends what waits, one entry at a time. Safe to call from anywhere, any number of times. */
export async function flush(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const user = all.some(pending) ? await whoAmI() : null;
    if (!user) return;
    for (;;) {
      const now = Date.now();
      const next = all.find((e) => e.user === user && pending(e) && (e.nextAt ?? 0) <= now);
      if (!next || !(await isOnline())) break;
      update(next.id, { state: "sending" });
      try {
        const patch = await send(next);
        update(next.id, { ...patch, state: "done", error: undefined, nextAt: undefined });
      } catch (err) {
        if (transient(err)) {
          const offline = !(await isOnline());
          const tries = offline ? next.tries : next.tries + 1;
          update(next.id, { state: "waiting", tries, nextAt: offline ? undefined : Date.now() + Math.min(30_000 * 2 ** tries, 10 * 60_000) });
          if (offline) break;
        } else {
          update(next.id, { state: "failed", error: errorKey(err) });
        }
      } finally {
        setProgress(next.id, null);
      }
      const after = all.find((e) => e.id === next.id);
      if (after && !pending(after)) await announce(after);
    }
  } finally {
    running = false;
    // Nothing left to send in the background: the « en cours » notification goes.
    if (!all.some((e) => e.notify && pending(e))) letGo();
  }
}

/** Something the journalist sent to the background: keep the app alive until it is done. Must be
 * called while the app is on screen (Android refuses a foreground service started from behind). */
export function holdForBackground(): boolean {
  const t = tr();
  return keepAlive(t.background.running, t.background.runningText);
}

/** Set at startup by `lib/background.ts`: a follow-up run once something is queued. */
let onQueued: () => void = () => undefined;
export function whenQueued(f: () => void) {
  onQueued = f;
}

function addEntry(user: string, ws: string, n: NewEntry): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const base = { id, user, ws, at: new Date().toISOString(), state: "waiting" as const, tries: 0 };
  let entry: Entry;
  if (n.kind === "check") {
    const file = n.check.file && !n.sourceId ? keep(id, n.check.file) : n.check.file;
    if (file?.size && file.size > MAX_BYTES) throw new ApiError(413, "too_large", "Files are limited to 25 MB");
    entry = { ...base, kind: "check", check: { ...n.check, file }, sourceId: n.sourceId, notify: n.notify, batch: n.batch };
  } else {
    entry = { ...base, kind: "claim", claim: n.claim };
  }
  commit([...all, entry]);
  onQueued();
  setTimeout(() => void flush(), 0);
  return id;
}

/** Every entry of a batch, in the order the screenshots came. */
export function useBatch(batch: string | undefined): Entry[] {
  const snapshot = useSyncExternalStore(subscribe, () => all);
  return useMemo(() => (batch ? snapshot.filter((e) => e.batch === batch) : []), [snapshot, batch]);
}

const OutboxContext = createContext<Ctx | null>(null);

export function OutboxProvider({ children }: { children: ReactNode }) {
  const { me, current } = useWorkspace();
  const snapshot = useSyncExternalStore(subscribe, () => all);
  const shares = useSyncExternalStore(subscribe, () => progress);
  const user = me?.id ?? null;
  const { light } = useLight();

  // Send when signed in, when the network comes back, when the app comes back to the front,
  // and every 30 s while something waits (backoff after a server failure).
  useEffect(() => {
    activeUser = user;
    if (!user) return;
    void flush();
    const off = onReconnect(() => void flush());
    const app = AppState.addEventListener("change", (s) => s === "active" && void flush());
    const tick = setInterval(() => {
      if (all.some((e) => e.user === user && e.state === "waiting")) void flush();
    }, pace(30_000));
    return () => {
      off();
      app.remove();
      clearInterval(tick);
    };
    // `light` re-arms the timer at the new pace.
  }, [user, light]);

  const value = useMemo<Ctx>(() => {
    const ws = current?.workspace_id;
    return {
      entries: snapshot.filter((e) => e.user === user && e.ws === ws),
      progress: shares,
      add: (n) => {
        if (!user || !ws) throw new ApiError(401, "unauthorized", "Not signed in");
        return addEntry(user, ws, n);
      },
      remove: (id) => {
        drop(all.find((e) => e.id === id));
        commit(all.filter((e) => e.id !== id));
      },
      retry: (id) => {
        update(id, { state: "waiting", nextAt: undefined, error: undefined });
        setTimeout(() => void flush(), 0);
      },
      clear: () => {
        try {
          if (DIR.exists) DIR.delete();
        } catch {
          // nothing to remove
        }
        all = [];
        progress = {};
        activeUser = null;
        letGo();
        emit();
      },
    };
  }, [snapshot, shares, user, current?.workspace_id]);

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): Ctx {
  const ctx = useContext(OutboxContext);
  if (!ctx) throw new Error("useOutbox outside OutboxProvider");
  return ctx;
}
