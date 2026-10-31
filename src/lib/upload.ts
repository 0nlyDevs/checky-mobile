import { File } from "expo-file-system";
import { createUploadTask, FileSystemUploadType } from "expo-file-system/legacy";

import { api, ApiError } from "@/lib/api";
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

/** Presigned PUT straight to storage (with progress), then the API turns it into a source. */
export async function uploadFile(ws: string, file: Picked, onProgress: (share: number) => void, itemId?: string): Promise<Source> {
  const f = normalise(file);
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
  return api<Source>(`/workspaces/${ws}/files/${up.file_id}/complete`, {
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
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new ApiError(408, "timeout", "The file is taking too long to read");
}
