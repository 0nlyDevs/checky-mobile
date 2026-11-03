import * as SecureStore from "expo-secure-store";

import { errorFrom } from "@/lib/api";
import type { components } from "@/lib/api-schema";
import { API_URL, WEB_URL } from "@/lib/config";

// The public side of the API (no account): only published verdicts leave a newsroom.
type Schemas = components["schemas"];
export type PublicVerdict = Schemas["VerdictOut"];
export type Newsroom = Schemas["NewsroomOut"];
export type TipStatus = Schemas["TipStatusOut"];
export type Ask = Schemas["AskOut"];
export type Match = Schemas["MatchOut"];

export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/public${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

export const publicFetcher = <T>(path: string) => publicApi<T>(path);

/** The phone's country as an ISO code, read from its locale (« fr-MG » → MG), or null. Public
 * searches cover every newsroom and put this country's first among equal answers, as on the web. */
export function deviceCountry(): string | null {
  try {
    const parts = Intl.DateTimeFormat().resolvedOptions().locale.split(/[-_]/);
    const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p));
    return region ? region.toUpperCase() : null;
  } catch {
    return null;
  }
}

/** The shareable page of a published verdict on the web. */
export const verdictLink = (id: string) => `${WEB_URL}/verifies/${id}`;

// Tips sent from this phone, so their follow-up can be found again (the token is the only key).
export type MyTip = { token: string; ref: string; title: string; newsroom: string; at: string };
const TIPS = "fanilo.tips";

export async function myTips(): Promise<MyTip[]> {
  try {
    return JSON.parse((await SecureStore.getItemAsync(TIPS)) ?? "[]") as MyTip[];
  } catch {
    return [];
  }
}

export async function rememberTip(tip: MyTip): Promise<void> {
  const all = [tip, ...(await myTips()).filter((t) => t.token !== tip.token)].slice(0, 12);
  await SecureStore.setItemAsync(TIPS, JSON.stringify(all)).catch(() => null);
}
