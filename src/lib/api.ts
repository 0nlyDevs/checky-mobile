import { authClient } from "@/lib/auth";
import { API_URL } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let cached: { token: string; exp: number } | null = null;
let inflight: Promise<string> | null = null;

function jwtExp(token: string): number {
  const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "="))).exp as number;
}

/** Short-lived JWT for FastAPI, refreshed a minute before it expires; one request at a time. */
export function getApiToken(): Promise<string> {
  if (cached && cached.exp - 60 > Date.now() / 1000) return Promise.resolve(cached.token);
  inflight ??= (async () => {
    const { data, error } = await authClient.token();
    if (error || !data) throw new ApiError(401, "unauthorized", "Not signed in");
    cached = { token: data.token, exp: jwtExp(data.token) };
    return data.token;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function clearApiToken() {
  cached = null;
}

export async function errorFrom(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const err = body?.error ?? {};
  return new ApiError(res.status, err.code ?? "http_error", err.message ?? `HTTP ${res.status}`);
}

/** On a weak network a request can hang with no answer: give up after a minute unless the caller
 * passes its own signal. */
const TIMEOUT_MS = 60_000;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getApiToken();
  const ctrl = init.signal ? null : new AbortController();
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      ...init,
      signal: init.signal ?? ctrl?.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...init.headers },
    });
    if (!res.ok) throw await errorFrom(res);
    return (res.status === 204 ? null : await res.json()) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const fetcher = <T>(path: string) => api<T>(path);
