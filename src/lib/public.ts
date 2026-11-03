import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { kv } from "@/lib/kv";

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
/** The web's « Est-ce déjà vérifié ? »: a signed verdict, else a fact-checker's review, else what is known. */
export type Verify = Schemas["app__modules__verify_public__VerifyOut"];
export type Review = Schemas["ReviewOut"];
export type Fact = Schemas["FactOut"];
export type ImageCheck = Schemas["ImageOut"];
/** Formats and size the public image check takes (checky-platform `imagecheck.IMAGE_TYPES`, 5 MB). */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/public${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

export const publicFetcher = <T>(path: string) => publicApi<T>(path);

/** The public image check (the extension's): the picture's own bytes as the body. Hints, a
 * detector's score and reverse-search links come back; nothing is stored and no verdict is given. */
export async function publicImageCheck(uri: string, mime: string): Promise<ImageCheck> {
  const bytes = new Uint8Array(await new File(uri).arrayBuffer());
  const res = await expoFetch(`${API_URL}/api/v1/public/image-check/file`, { method: "POST", headers: { "content-type": mime }, body: bytes });
  if (!res.ok) throw await errorFrom(res as unknown as Response);
  return (await res.json()) as ImageCheck;
}

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
    return JSON.parse((await kv.getItemAsync(TIPS)) ?? "[]") as MyTip[];
  } catch {
    return [];
  }
}

export async function rememberTip(tip: MyTip): Promise<void> {
  const all = [tip, ...(await myTips()).filter((t) => t.token !== tip.token)].slice(0, 12);
  await kv.setItemAsync(TIPS, JSON.stringify(all)).catch(() => null);
}
