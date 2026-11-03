import { Linking } from "react-native";

import type { CheckResult } from "@/lib/types";

/** What the analysis screen checks. Handed over in memory, never through route params, so a
 * `fanilo://analyse?file=…` deep link from a web page cannot make the app upload a local file
 * or start a check on its own. */
export type Check = {
  url?: string;
  text?: string;
  file?: { uri: string; mime: string; name: string; size?: number | null };
  shared?: boolean;
  /** An outbox entry (`lib/outbox.tsx`) sent once the network came back. */
  queued?: string;
  /** Already checked (the selection-menu sheet): shown as is, not run again. */
  result?: CheckResult;
};

const pending = new Map<string, Check>();
let seq = 0;

export function handOff(check: Check): string {
  const id = `${Date.now().toString(36)}-${++seq}`;
  pending.set(id, check);
  return id;
}

/** Read (not consumed, so a re-render or a fast refresh keeps it); a stale or forged id gives null. */
export function pickUp(id: string | undefined): Check | null {
  return (id && pending.get(id)) || null;
}

/** Links come from fetched pages and search results: only web addresses are opened. */
export function openWeb(url: string | null | undefined): void {
  if (!url) return;
  try {
    const { protocol } = new URL(url);
    if (protocol === "http:" || protocol === "https:") void Linking.openURL(url);
  } catch {
    // not a URL: ignore
  }
}
