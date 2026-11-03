import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { createUploadTask, FileSystemUploadType } from "expo-file-system/legacy";

import { api, ApiError } from "@/lib/api";
import { isLight, pace } from "@/lib/light";
import type { Source } from "@/lib/types";

export const MAX_BYTES = 25 * 1024 * 1024;
// What the API accepts (apps/api/app/modules/sources.py, KIND_BY_MIME).
export const ACCEPTED = /^(image\/(jpeg|png|webp|gif|heic)|application\/pdf|audio\/(mpeg|mp4|x-m4a|m4a|wav|x-wav|webm|ogg)|video\/(mp4|webm|quicktime|3gpp))$/;

export type Picked = { uri: string; mime: string; name: string; size?: number | null };

export function normalise(p: Picked): Picked {
  const mime = p.mime === "image/jpg" ? "image/jpeg" : p.mime === "audio/x-mp4" ? "audio/mp4" : p.mime;
  let size = p.size ?? null;
  if (!size) {
    try {
      size = new File(p.uri).size;
    } catch {
      size = null;
    }
  }
  return { ...p, mime, size };
}

const LIGHT_EDGE = 1600;

/** Mode léger (brief 6.3): a photo is resized to 1600 px and re-encoded as JPEG before it
 * leaves. That strips EXIF, C2PA and generator tags, which the Réglages switch says; a GIF or a
 * file that cannot be read goes as it is. */
export async function lighten(p: Picked): Promise<Picked> {
  if (!isLight() || !/^image\/(jpeg|png|webp|heic)$/.test(p.mime)) return p;
  try {
    const first = await ImageManipulator.manipulate(p.uri).renderAsync();
    const big = Math.max(first.width, first.height) > LIGHT_EDGE;
    const ref = big
      ? await ImageManipulator.manipulate(p.uri)
          .resize(first.width >= first.height ? { width: LIGHT_EDGE } : { height: LIGHT_EDGE })
          .renderAsync()
      : first;
    const out = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
    return normalise({ uri: out.uri, mime: "image/jpeg", name: p.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", size: null });
  } catch {
    return p;
  }
}

/** Presigned PUT straight to storage (with progress): the file is left `pending`, for the caller to complete. */
async function putToStorage(ws: string, f: Picked, onProgress: (share: number) => void): Promise<string> {
  if (!ACCEPTED.test(f.mime)) throw new ApiError(415, "unsupported_type", f.mime);
  if (!f.size) throw new ApiError(400, "unreadable", "Unknown file size");
  if (f.size > MAX_BYTES) throw new ApiError(413, "too_large", "Files are limited to 25 MB");
  const up = await api<{ file_id: string; upload_url: string; headers: Record<string, string> }>(
    `/workspaces/${ws}/files/upload-url`,
    { method: "POST", body: JSON.stringify({ filename: f.name, mime: f.mime, size_bytes: f.size }) },
  );
  const task = createUploadTask(
    up.upload_url,
    f.uri,
    { httpMethod: "PUT", uploadType: FileSystemUploadType.BINARY_CONTENT, headers: up.headers },
    (p) => p.totalBytesExpectedToSend && onProgress(p.totalBytesSent / p.totalBytesExpectedToSend),
  );
  const res = await task.uploadAsync();
  if (!res || res.status >= 300) throw new ApiError(res?.status ?? 0, "upload_failed", "Upload failed");
  onProgress(1);
  return up.file_id;
}

/** Upload without turning the file into a source: a voice note is attached by its own route and never read. */
export async function uploadUnread(ws: string, file: Picked, onProgress: (share: number) => void): Promise<string> {
  return putToStorage(ws, normalise(file), onProgress);
}

/** Presigned PUT straight to storage (with progress), then the API turns it into a source. */
export async function uploadFile(ws: string, file: Picked, onProgress: (share: number) => void, itemId?: string): Promise<Source> {
  const f = await lighten(normalise(file));
  const fileId = await putToStorage(ws, f, onProgress);
  return api<Source>(`/workspaces/${ws}/files/${fileId}/complete`, {
    method: "POST",
    body: JSON.stringify(itemId ? { item_id: itemId } : {}),
  });
}

/** Wait for the ingest job (transcription, EXIF…) to finish. */
export async function waitReady(ws: string, id: string, signal?: AbortSignal, timeoutMs = 5 * 60_000): Promise<Source> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (signal?.aborted) throw new ApiError(0, "aborted", "Cancelled");
    const s = await api<Source>(`/workspaces/${ws}/sources/${id}`);
    if (s.status === "ready") return s;
    if (s.status === "failed") throw new ApiError(422, "source_failed", s.error ?? "failed");
    await new Promise((r) => setTimeout(r, pace(2000)));
  }
  throw new ApiError(408, "timeout", "The file is taking too long to read");
}
