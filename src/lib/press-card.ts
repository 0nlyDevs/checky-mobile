import { File } from "expo-file-system";
import { useEffect, useSyncExternalStore } from "react";
import { createUploadTask, FileSystemUploadType } from "expo-file-system/legacy";

import { api, ApiError } from "@/lib/api";
import { tr } from "@/lib/i18n";

export const CARD_MAX_BYTES = 8 * 1024 * 1024;
// What the API accepts for a press card (apps/api/app/modules/profile.py, CARD_TYPES).
const CARD_TYPE = /^image\/(jpeg|png|webp)$/;

export type Card = { uri: string; mime: string; name: string; size: number | null };

/** The i18n key of the problem, or null when the photo can be sent. Checked before the account exists. */
export function cardProblem(card: Card | null): "cardRequired" | "cardType" | "cardSize" | null {
  if (!card) return "cardRequired";
  if (!CARD_TYPE.test(card.mime)) return "cardType";
  if (card.size && card.size > CARD_MAX_BYTES) return "cardSize";
  return null;
}

/** A picker asset as a card: the size is read from the file when the picker did not give it. */
export function toCard(asset: { uri: string; mimeType?: string | null; fileName?: string | null; fileSize?: number | null }): Card {
  const mime = (asset.mimeType === "image/jpg" ? "image/jpeg" : asset.mimeType) ?? "image/jpeg";
  let size = asset.fileSize ?? null;
  if (!size) {
    try {
      size = new File(asset.uri).size;
    } catch {
      size = null;
    }
  }
  const ext = mime.split("/")[1] ?? "jpg";
  return { uri: asset.uri, mime, name: asset.fileName ?? `carte.${ext}`, size };
}

/** Presigned PUT straight to storage, then the API reads the file back and refuses anything that is
 * not a real, readable image before saving the profile. */
export async function saveProfile(input: { phone: string; outlet: string; cardNumber: string; card: Card }) {
  const { card } = input;
  if (!card.size) throw new ApiError(400, "unreadable", "Unknown file size");
  const up = await api<{ card_key: string; upload_url: string; headers: Record<string, string> }>("/me/press-card/upload-url", {
    method: "POST",
    body: JSON.stringify({ filename: card.name, mime: card.mime, size_bytes: card.size }),
  });
  const res = await createUploadTask(up.upload_url, card.uri, {
    httpMethod: "PUT",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: up.headers,
  }).uploadAsync();
  if (!res || res.status >= 300) throw new ApiError(res?.status ?? 0, "upload_failed", "Upload failed");
  return api("/me/profile", {
    method: "PUT",
    body: JSON.stringify({
      phone: input.phone.trim(),
      outlet: input.outlet.trim(),
      card_number: input.cardNumber.trim() || null,
      card_key: up.card_key,
      card_filename: card.name,
    }),
  });
}

// Signing up opens the session at once and the router drops the form, so the card is sent from here,
// from a store that outlives the screen, and a banner in the root layout offers a retry on failure.
type Input = { phone: string; outlet: string; cardNumber: string; card: Card };
type State = { input: Input | null; sending: boolean; error: string | null };
let state: State = { input: null, sending: false, error: null };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

/** Remember the sign-up details to send as soon as the session is open. */
export function queueProfile(input: Input) {
  set({ input, sending: false, error: null });
}

export function discardQueuedProfile() {
  set({ input: null, sending: false, error: null });
}

function messageFor(e: unknown): string {
  const code = e instanceof ApiError ? (e.status === 422 && e.code !== "invalid_card" ? "phone_invalid" : e.code) : "";
  const t = tr();
  return t.auth.cardErrors[code] ?? t.auth.failed;
}

export async function sendQueuedProfile() {
  const input = state.input;
  if (!input || state.sending) return;
  set({ sending: true, error: null });
  try {
    await saveProfile(input);
    set({ input: null, sending: false });
  } catch (e) {
    set({ sending: false, error: messageFor(e) });
  }
}

/** Mounted once while signed in: sends a queued profile, and reports where it stands. */
export function usePendingProfile(signedIn: boolean) {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  useEffect(() => {
    if (signedIn && s.input && !s.sending && !s.error) void sendQueuedProfile();
  }, [signedIn, s.input, s.sending, s.error]);
  return { pending: !!s.input, sending: s.sending, error: s.error, retry: sendQueuedProfile };
}
