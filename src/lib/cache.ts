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
let timer: ReturnType<typeof setTimeout> | null = null;

function save() {
  timer = null;
  if (!map) return;
  const kept = [...map].filter(([k, v]) => !k.startsWith("$") && !SKIP.has(k) && v?.data !== undefined).map(([k, v]) => [k, { data: v.data }]);
  try {
    FILE.writeSync(JSON.stringify(kept));
  } catch {
    // a full disk only costs the offline copy
  }
}

function later() {
  if (!timer) timer = setTimeout(save, 2000);
}

export function persistentCache(): Cache {
  if (map) return map as unknown as Cache;
  let saved: [string, Entry][] = [];
  try {
    if (FILE.exists) saved = JSON.parse(FILE.textSync());
  } catch {
    saved = [];
  }
  const m = new Map<string, Entry>(saved);
  const set = m.set.bind(m);
  m.set = (k, v) => {
    later();
    return set(k, v);
  };
  map = m;
  AppState.addEventListener("change", (s) => {
    if (s !== "active") save();
  });
  return m as unknown as Cache;
}

export function clearCache() {
  if (timer) clearTimeout(timer);
  timer = null;
  map?.clear();
  try {
    if (FILE.exists) FILE.delete();
  } catch {
    // nothing to remove
  }
}
