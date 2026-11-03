import { Directory, File, Paths } from "expo-file-system";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { api, ApiError } from "@/lib/api";
import { pace, useLight } from "@/lib/light";
import { isNetworkError, isOnline, onReconnect } from "@/lib/network";
import { postStream } from "@/lib/sse";
import type { CheckResult, Origin } from "@/lib/types";
import { MAX_BYTES, normalise, uploadFile, waitReady } from "@/lib/upload";
import { useWorkspace } from "@/lib/workspace";

/** "À envoyer": what a journalist captures without a network (a shared video, a photo, a link, a
 * new claim) is kept on the phone and sent when the network comes back, while the app is open.
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
};

export type NewEntry = { kind: "check"; check: QueuedCheck; sourceId?: string } | { kind: "claim"; claim: { title: string; origin: Origin } };

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

function persist(all: Entry[]) {
  try {
    DIR.create({ idempotent: true, intermediates: true });
    INDEX.writeSync(JSON.stringify(all));
  } catch {
    // kept in memory for this session at least
  }
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

const OutboxContext = createContext<Ctx | null>(null);

export function OutboxProvider({ children }: { children: ReactNode }) {
  const { me, current } = useWorkspace();
  const [all, setAll] = useState<Entry[]>(load);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const ref = useRef(all);
  const running = useRef(false);
  const user = me?.id ?? null;
  const { light } = useLight();

  const commit = useCallback((next: Entry[]) => {
    ref.current = next;
    setAll(next);
    persist(next);
  }, []);

  const update = useCallback((id: string, patch: Partial<Entry>) => commit(ref.current.map((e) => (e.id === id ? { ...e, ...patch } : e))), [commit]);

  const send = useCallback(
    async (e: Entry): Promise<Partial<Entry>> => {
      if (e.kind === "claim" && e.claim) {
        const made = await api<{ item_id: string }>(`/workspaces/${e.ws}/copilot/act`, {
          method: "POST",
          body: JSON.stringify({ kind: "create_claim", title: e.claim.title, origin: e.claim.origin }),
        });
        return { itemId: made.item_id };
      }
      const check = e.check ?? {};
      let sourceId = e.sourceId;
      if (check.file && !sourceId) {
        const src = await uploadFile(e.ws, check.file, (share) => setProgress((p) => ({ ...p, [e.id]: share })));
        sourceId = src.id;
        update(e.id, { sourceId });
      }
      if (sourceId) await waitReady(e.ws, sourceId);
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
      return { result };
    },
    [update],
  );

  const flush = useCallback(async () => {
    if (running.current || !user) return;
    running.current = true;
    try {
      for (;;) {
        const now = Date.now();
        const next = ref.current.find((e) => e.user === user && (e.state === "waiting" || e.state === "sending") && (e.nextAt ?? 0) <= now);
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
          setProgress(({ [next.id]: _, ...rest }) => rest);
        }
      }
    } finally {
      running.current = false;
    }
  }, [user, update, send]);

  // Send when signed in, when the network comes back, when the app comes back to the front,
  // and every 30 s while something waits (backoff after a server failure).
  useEffect(() => {
    if (!user) return;
    void flush();
    const off = onReconnect(() => void flush());
    const app = AppState.addEventListener("change", (s) => s === "active" && void flush());
    const tick = setInterval(() => {
      if (ref.current.some((e) => e.user === user && e.state === "waiting")) void flush();
    }, pace(30_000));
    return () => {
      off();
      app.remove();
      clearInterval(tick);
    };
    // `light` re-arms the timer at the new pace.
  }, [user, flush, light]);

  const value = useMemo<Ctx>(() => {
    const ws = current?.workspace_id;
    return {
      entries: all.filter((e) => e.user === user && e.ws === ws),
      progress,
      add: (n) => {
        if (!user || !ws) throw new ApiError(401, "unauthorized", "Not signed in");
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const base = { id, user, ws, at: new Date().toISOString(), state: "waiting" as const, tries: 0 };
        let entry: Entry;
        if (n.kind === "check") {
          const file = n.check.file && !n.sourceId ? keep(id, n.check.file) : n.check.file;
          if (file?.size && file.size > MAX_BYTES) throw new ApiError(413, "too_large", "Files are limited to 25 MB");
          entry = { ...base, kind: "check", check: { ...n.check, file }, sourceId: n.sourceId };
        } else {
          entry = { ...base, kind: "claim", claim: n.claim };
        }
        commit([...ref.current, entry]);
        setTimeout(() => void flush(), 0);
        return id;
      },
      remove: (id) => {
        drop(ref.current.find((e) => e.id === id));
        commit(ref.current.filter((e) => e.id !== id));
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
        ref.current = [];
        setAll([]);
      },
    };
  }, [all, progress, user, current?.workspace_id, commit, update, flush]);

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): Ctx {
  const ctx = useContext(OutboxContext);
  if (!ctx) throw new Error("useOutbox outside OutboxProvider");
  return ctx;
}
