import { File, Paths } from "expo-file-system";
import { AppState } from "react-native";
import type { Cache } from "swr";

/** The SWR cache, kept on the phone so claims, files and verdicts already opened stay readable
 * without a network, and the app opens offline (the newsroom comes from the cached `/me`).
 * Only data is kept, never errors. Wiped on sign-out (`clearCache`). */
const FILE = new File(Paths.document, "swr-cache.json");
// Live server state that would mislead if shown stale.
const SKIP = new Set(["health"]);

type Entry = { data?: unknown };
let map: Map<string, Entry> | null = null;
// When each key's data last changed (ms), kept beside it: screens say how old an offline copy is.
const stamps = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | null = null;

function save() {
  timer = null;
  if (!map) return;
  const kept = [...map].filter(([k, v]) => !k.startsWith("$") && !SKIP.has(k) && v?.data !== undefined).map(([k, v]) => [k, { data: v.data, at: stamps.get(k) }]);
  try {
    FILE.writeSync(JSON.stringify(kept));
  } catch {
    // a full disk only costs the offline copy
  }
}

function later() {
  if (!timer) timer = setTimeout(save, 2000);
}

let listening = false;

function load(): Map<string, Entry> {
  let saved: [string, Entry & { at?: number }][] = [];
  try {
    if (FILE.exists) saved = JSON.parse(FILE.textSync());
  } catch {
    saved = [];
  }
  for (const [k, v] of saved) if (v?.at) stamps.set(k, v.at);
  return new Map<string, Entry>(saved.filter(([, v]) => v && typeof v === "object").map(([k, v]) => [k, { data: v.data }]));
}

/**
 * SWR's cache provider. Each call returns a new Map holding the entries so far: SWR keys its
 * internal state by the Map, and when the root layout remounts (Android brings the app back after
 * the photo picker, a low-memory phone recreates it) the old SWRConfig's cleanup deletes the state
 * of the Map it had. Handing the same Map to the new one crashed the app (« Cannot convert
 * undefined value to object » in useSWRHandler).
 */
export function persistentCache(): Cache {
  // Only the data carries over; SWR's own flags (a fetch in flight, an error) belong to the old Map.
  const m = map ? new Map<string, Entry>([...map].filter(([k, v]) => !k.startsWith("$") && v?.data !== undefined).map(([k, v]) => [k, { data: v.data }])) : load();
  const set = m.set.bind(m);
  m.set = (k, v) => {
    // New data, or a fetch that ended well with the same data (SWR keeps the old object then).
    const prev = m.get(k) as (Entry & { isValidating?: boolean }) | undefined;
    const state = v as Entry & { isValidating?: boolean; error?: unknown };
    if (state?.data !== undefined && (state.data !== prev?.data || (prev?.isValidating && !state.isValidating && !state.error))) stamps.set(k, Date.now());
    later();
    return set(k, v);
  };
  map = m;
  if (!listening) {
    listening = true;
    AppState.addEventListener("change", (s) => {
      if (s !== "active") save();
    });
  }
  return m as unknown as Cache;
}

export function clearCache() {
  if (timer) clearTimeout(timer);
  timer = null;
  map?.clear();
  stamps.clear();
  try {
    if (FILE.exists) FILE.delete();
  } catch {
    // nothing to remove
  }
}

/** When this key's data was last fetched (ms), for « données du … » while offline. */
export function cachedAt(key: string | null | undefined): number | undefined {
  return key ? stamps.get(key) : undefined;
}
