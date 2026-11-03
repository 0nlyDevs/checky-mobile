import { Directory, File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

import { api } from "@/lib/api";
import type { components } from "@/lib/api-schema";
import { isOnline } from "@/lib/network";
import { deviceCountry, publicApi, type PublicVerdict } from "@/lib/public";
import type { PublicKey, RegistryEntry, RevokedKey, SealStore } from "@/lib/seal";
import type { ClaimData, Comment, ItemPage, Source } from "@/lib/types";

/** What the phone keeps to work with no network (brief 0.9, 6.3): the issuer keys and revoked
 * keys, the last 90 days of the registry (text only), the published verdicts, and for a
 * journalist « Ma rubrique », the directory, the figures and the desk's dossiers.
 *
 * Each set is one JSON file under `documentDirectory/offline/`, stamped with when it was taken.
 * The dossiers go into the SWR cache instead (`cache.ts`), so the existing screens read them
 * offline as they are. Synced on open, when the network returns and when the app comes back
 * to the front (at most every 10 min, 30 in Mode léger). */

type Schemas = components["schemas"];
export type Contact = Schemas["ContactOut"];
export type Figure = Schemas["FigureOut"];
export type Rubrique = Schemas["RubriqueOut"];
export type RegistryRow = RegistryEntry & { kind: "original" | "fake_caught"; url: string | null; created_at: string; confirmed?: boolean; sealedQr?: boolean };
export type Stored<T> = { at: number; data: T };

const DIR = new Directory(Paths.document, "offline");
const DAYS_90 = 90 * 24 * 3600 * 1000;

export const keys = {
  seal: "seal-keys",
  publicRegistry: "registry-public",
  verdicts: "verdicts",
  registry: (ws: string) => `ws-${ws}-registry`,
  contacts: (ws: string) => `ws-${ws}-contacts`,
  figures: (ws: string) => `ws-${ws}-figures`,
  rubrique: (ws: string) => `ws-${ws}-rubrique`,
};

const mem = new Map<string, Stored<unknown> | null>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function fileOf(key: string): File {
  return new File(DIR, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}

export function readStored<T>(key: string): Stored<T> | null {
  if (!mem.has(key)) {
    let v: Stored<unknown> | null = null;
    try {
      const f = fileOf(key);
      if (f.exists) v = JSON.parse(f.textSync());
    } catch {
      v = null;
    }
    mem.set(key, v);
  }
  return mem.get(key) as Stored<T> | null;
}

export function writeStored<T>(key: string, data: T): void {
  const v = { at: Date.now(), data };
  mem.set(key, v);
  try {
    DIR.create({ idempotent: true, intermediates: true });
    fileOf(key).writeSync(JSON.stringify(v));
  } catch {
    // a full disk only costs the offline copy
  }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** A kept set and when it was taken; re-renders when a sync replaces it. */
export function useStored<T>(key: string | null): Stored<T> | null {
  return useSyncExternalStore(subscribe, () => (key ? readStored<T>(key) : null));
}

/** Sign-out: the newsroom's sets go; the public ones (keys, registry, verdicts) stay. */
export function clearDeskOffline(): void {
  for (const k of [...mem.keys()]) if (k.startsWith("ws-")) mem.delete(k);
  try {
    for (const f of DIR.exists ? DIR.list() : []) if (f instanceof File && f.name.startsWith("ws-")) f.delete();
  } catch {
    // nothing to remove
  }
  emit();
}

// --- the seal store: keys, revoked keys and every registry kept -----------------------------

type KeysOut = Schemas["SealKeysOut"];

/** Everything the scanner checks against, merged from the kept sets. */
export function useSealStore(ws: string | null): { store: SealStore; at: number | null } {
  const sealKeys = useStored<KeysOut>(keys.seal);
  const own = useStored<RegistryRow[]>(ws ? keys.registry(ws) : null);
  const pub = useStored<RegistryRow[]>(keys.publicRegistry);
  const registry = [...(own?.data ?? []), ...(pub?.data ?? [])];
  return {
    store: { keys: (sealKeys?.data.keys ?? []) as PublicKey[], revoked: (sealKeys?.data.revoked ?? []) as RevokedKey[], registry },
    at: sealKeys?.at ?? null,
  };
}

// --- sync ------------------------------------------------------------------------------------

type SyncState = { running: boolean; at: number | null; failed: boolean; slow: boolean };
let state: SyncState = { running: false, at: null, failed: false, slow: false };
const setState = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  emit();
};

export function useSyncState(): SyncState {
  const s = useSyncExternalStore(subscribe, () => state);
  return s.at ? s : { ...s, at: readStored<number>(LAST)?.data ?? null };
}

/** Primes an SWR key so an existing screen reads it offline (the SWR `mutate` of the app's cache). */
export type Prime = (key: string, data: unknown) => void;

const recent = (iso: string | null | undefined) => !!iso && Date.now() - new Date(iso).getTime() <= DAYS_90;

type CommuniqueOut = Schemas["CommuniqueOut"];
type OfficialOut = Schemas["OfficialPage-Output"]["items"][number];

/** Text only: the diff and place details stay on the server. */
function fromDesk(c: CommuniqueOut): RegistryRow {
  return {
    id: c.id,
    issuer: c.issuer,
    number: c.number,
    issued_on: c.issued_on,
    title: c.title,
    text: c.text,
    fingerprint: c.fingerprint,
    is_demo: c.is_demo,
    newsroom: c.newsroom,
    sealed: c.sealed ? { key_id: c.sealed.key_id, signature: c.sealed.signature } : null,
    kind: c.status,
    url: c.url,
    created_at: c.created_at,
    confirmed: c.confirmed,
    sealedQr: !!c.sealed,
  };
}

function fromFeed(c: OfficialOut): RegistryRow {
  return {
    id: c.id,
    issuer: c.issuer,
    number: c.number,
    issued_on: c.issued_on,
    title: c.title,
    text: c.text,
    is_demo: c.is_demo,
    newsroom: c.newsroom,
    kind: c.kind,
    url: c.url,
    created_at: c.created_at,
    confirmed: c.confirmed,
    sealedQr: c.sealed,
  };
}

async function publicRegistry(): Promise<RegistryRow[]> {
  const out: RegistryRow[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const page = await publicApi<Schemas["OfficialPage-Output"]>(`/registry?limit=100&offset=${offset}`);
    const kept = page.items.filter((c) => recent(c.created_at) || recent(c.issued_on));
    out.push(...kept.map(fromFeed));
    // Newest first: once a page holds older entries, the rest is older still.
    if (page.items.length < 100 || kept.length < page.items.length) break;
  }
  return out;
}

async function deskRegistry(ws: string): Promise<RegistryRow[]> {
  const [mine, network] = await Promise.all([
    api<CommuniqueOut[]>(`/workspaces/${ws}/registry`),
    api<CommuniqueOut[]>(`/workspaces/${ws}/registry?scope=network`).catch(() => [] as CommuniqueOut[]),
  ]);
  return [...mine, ...network].filter((c) => recent(c.created_at) || recent(c.issued_on)).map(fromDesk);
}

async function sealKeys(ws: string | null, room: { slug: string; name: string } | null): Promise<KeysOut> {
  const out = await publicApi<KeysOut>("/seal-keys");
  if (!ws || !room) return out;
  // A newsroom that does not publish yet still checks the seals it made itself.
  type KeyOut = { key_id: string; issuer: string; public_key: string; created_at: string; revoked_at?: string | null };
  const own = await api<KeyOut[]>(`/workspaces/${ws}/registry/keys`).catch(() => [] as KeyOut[]);
  const known = new Set([...out.keys, ...out.revoked].map((k) => k.key_id));
  for (const k of own) {
    if (known.has(k.key_id)) continue;
    const base = { key_id: k.key_id, issuer: k.issuer, kind: "communique" as const, newsroom: room };
    if (k.revoked_at) out.revoked.push({ ...base, revoked_at: k.revoked_at });
    else out.keys.push({ ...base, alg: "Ed25519", public_key: k.public_key, created_at: k.created_at });
  }
  return out;
}

async function verdicts(prime: Prime): Promise<PublicVerdict[]> {
  const country = deviceCountry();
  const tail = country ? `&country=${country}` : "";
  const all: PublicVerdict[] = [];
  for (let offset = 0; offset < 200; offset += 50) {
    const page = await publicApi<Schemas["VerdictPage"]>(`/verdicts?limit=50&offset=${offset}${tail}`);
    all.push(...page.items);
    if (all.length >= page.total || page.items.length < 50) break;
  }
  // The citizen screens read these keys.
  prime(`/verdicts?limit=5${tail}`, { items: all.slice(0, 5), total: all.length });
  for (const v of all) prime(`/verdicts/${v.id}`, v);
  return all;
}

/** The dossiers list as the Dossiers tab asks for it, each dossier's detail, its sources, and
 * the comments of the dossiers that changed since the last sync. */
async function dossiers(ws: string, prime: Prime, since: number, light: boolean): Promise<void> {
  const listKey = `/workspaces/${ws}/items?type=claim&limit=200`;
  const page = await api<ItemPage>(listKey);
  prime(listKey, page);
  for (const item of page.items) prime(`/workspaces/${ws}/items/${item.id}`, item);
  const sources = await api<Source[]>(`/workspaces/${ws}/sources`).catch(() => null);
  if (sources) {
    const byItem = new Map<string, Source[]>();
    for (const s of sources) if (s.item_id) byItem.set(s.item_id, [...(byItem.get(s.item_id) ?? []), s]);
    for (const item of page.items) {
      const found = byItem.get(item.id) ?? [];
      // The list stops at 200 sources: prime only dossiers it covers whole.
      if (found.length >= ((item.data as ClaimData).source_count ?? 0)) prime(`/workspaces/${ws}/sources?item_id=${item.id}`, found);
    }
  }
  const changed = page.items.filter((i) => new Date(i.updated_at).getTime() > since).slice(0, light ? 8 : 25);
  for (let i = 0; i < changed.length; i += 3) {
    await Promise.all(
      changed.slice(i, i + 3).map(async (item) => {
        const key = `/workspaces/${ws}/items/${item.id}/comments`;
        const comments = await api<Comment[]>(key).catch(() => null);
        if (comments) prime(key, comments);
      }),
    );
  }
}

const SLOW_MS = 4000;
// The last full sync of this newsroom (cleared on sign-out with the rest of the desk's sets).
const LAST = "ws-last-sync";

/** Fetch every set this phone keeps. Each set stands alone: one failing keeps the others. */
export async function syncOffline(opts: { ws: string | null; room: { slug: string; name: string } | null; prime: Prime; light: boolean; force?: boolean }): Promise<void> {
  const { ws, room, prime, light } = opts;
  if (state.running) return;
  const every = (light ? 30 : 10) * 60_000;
  if (!opts.force && state.at && Date.now() - state.at < every) return;
  if (!(await isOnline())) return;
  const since = readStored<number>(LAST)?.data ?? 0;
  setState({ running: true, failed: false });
  let failed = false;
  const run = async (job: () => Promise<void>) => {
    try {
      await job();
    } catch {
      failed = true;
    }
  };
  try {
    const t0 = Date.now();
    await run(async () => writeStored(keys.seal, await sealKeys(ws, room)));
    // A small request taking this long: the link is slow, Mode léger is worth suggesting.
    setState({ slow: Date.now() - t0 > SLOW_MS });
    await run(async () => writeStored(keys.verdicts, await verdicts(prime)));
    if (ws) {
      await run(async () => writeStored(keys.registry(ws), await deskRegistry(ws)));
      await run(() => dossiers(ws, prime, since, light));
      await run(async () => writeStored(keys.rubrique(ws), await api<Rubrique>(`/workspaces/${ws}/rubrique`)));
      await run(async () => writeStored(keys.contacts(ws), await api<Contact[]>(`/workspaces/${ws}/contacts`)));
      await run(async () => writeStored(keys.figures(ws), await api<Figure[]>(`/workspaces/${ws}/figures`)));
    } else {
      await run(async () => writeStored(keys.publicRegistry, await publicRegistry()));
    }
  } finally {
    const now = Date.now();
    if (!failed) writeStored(LAST, now);
    setState({ running: false, failed, at: failed && state.at ? state.at : now });
  }
}
