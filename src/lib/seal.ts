import * as ed from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2.js";

/** Checking a Checky seal QR with no network (brief 3.4, 4.6), the phone's twin of fanilo-base's
 * `app/core/seal.py`. Pure: no React Native import, so `node --test` runs it against signatures
 * made by the server.
 *
 * Three QR formats:
 * - a signed verdict card: `…/verifies/{id}#<b64u(message)>.<signature>.<key_id>`
 * - a sealed communiqué: `…/sceau/{cid}#<b64u(canonical payload)>.<signature>.<key_id>`
 * - an older communiqué QR: `…/sceau/{cid}#<signature>`, whose signed fields are rebuilt from
 *   the registry kept on the phone.
 *
 * A seal proves who signed these words, never that they are true. Anything we cannot settle
 * offline says so (« Émetteur inconnu de ce téléphone »), it never says « Faux ». */

ed.hashes.sha512 = sha512;

export type KeyRoom = { slug: string; name: string };
export type PublicKey = { key_id: string; issuer: string; kind?: string; public_key: string; newsroom: KeyRoom };
export type RevokedKey = { key_id: string; issuer: string; kind?: string; revoked_at: string; newsroom: KeyRoom };
export type RegistryEntry = {
  id: string;
  issuer: string;
  number: string | null;
  issued_on: string | null;
  title: string;
  text: string;
  fingerprint?: string | null;
  is_demo?: boolean;
  newsroom?: KeyRoom | null;
  sealed?: { key_id: string; signature: string } | null;
};
export type SealStore = { keys: PublicKey[]; revoked: RevokedKey[]; registry: RegistryEntry[] };

export type Parsed =
  | { type: "verdict"; id: string; message: string; signature: string; keyId: string }
  | { type: "communique"; id: string; message: string; signature: string; keyId: string }
  | { type: "communique_legacy"; id: string; signature: string };

/** What was signed, to compare with the paper in hand. */
export type SignedFields = {
  title: string;
  issuer?: string;
  number?: string | null;
  date?: string | null;
  verdict?: string;
  ref?: string | null;
};

export type SealResult =
  // Not a Checky seal at all (an ordinary link, a product code…).
  | { status: "not_seal"; text: string }
  | { status: "authentic"; kind: "verdict" | "communique"; fields: SignedFields; signer: string; newsroom: KeyRoom; demo: boolean }
  // The signature does not match these words: altered, or copied onto another document.
  | { status: "mismatch"; kind: "verdict" | "communique" }
  | { status: "revoked"; kind: "verdict" | "communique"; signer: string; newsroom: KeyRoom; revokedAt: string }
  // A key this phone has never seen (created after the last sync, or not one of ours).
  | { status: "unknown_issuer"; kind: "verdict" | "communique" }
  // An older communiqué QR whose entry is not in the registry kept on this phone.
  | { status: "not_cached"; kind: "communique" };

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Standard or URL-safe base64, padded or not. Throws on anything else. */
export function fromBase64(value: string): Uint8Array {
  const clean = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (/[^A-Za-z0-9+/]/.test(clean) || clean.length % 4 === 1) throw new Error("bad base64");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let n = 0;
  for (const ch of clean) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

export function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return Uint8Array.from(out);
}

/** Strict UTF-8 decoding (Hermes has no reliable TextDecoder); throws on a malformed byte. */
export function fromUtf8(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    const len = b < 0x80 ? 1 : b >> 5 === 6 ? 2 : b >> 4 === 14 ? 3 : b >> 3 === 30 ? 4 : 0;
    if (!len || i + len > bytes.length) throw new Error("bad utf-8");
    let cp = len === 1 ? b : b & (0xff >> (len + 1));
    for (let j = 1; j < len; j++) {
      const c = bytes[i + j];
      if (c >> 6 !== 2) throw new Error("bad utf-8");
      cp = (cp << 6) | (c & 63);
    }
    s += String.fromCodePoint(cp);
    i += len;
  }
  return s;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// Python's `\s` on str (str.isspace): JS `\s` minus U+FEFF, plus \x1c-\x1f and U+0085.
const SPACE = /[\t-\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

/** `seal.normalise`: NFC, runs of whitespace collapsed, trimmed. */
export function normalise(text: string): string {
  const nfc = typeof text.normalize === "function" ? text.normalize("NFC") : text;
  return nfc.replace(SPACE, " ").replace(/^ | $/g, "");
}

/** `seal.fingerprint`: SHA-256 of the normalised text, in hex. */
export function fingerprint(text: string): string {
  return hex(sha256(utf8(normalise(text ?? ""))));
}

/** `seal.canonical` for flat payloads: sorted keys, no spaces, UTF-8 kept as is. */
export function canonical(payload: Record<string, string | null>): string {
  return `{${Object.keys(payload)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${JSON.stringify(payload[k])}`)
    .join(",")}}`;
}

/** The fields an issuer signs for a communiqué (`seal.payload_of`). */
export function communiquePayload(e: RegistryEntry): Record<string, string | null> {
  return { issuer: e.issuer, number: e.number, issued_on: e.issued_on, title: e.title, fingerprint: e.fingerprint || fingerprint(e.text) };
}

const QR = /^https?:\/\/[^/?#\s]+(?:\/[^?#\s]*)?\/(verifies|sceau)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:\?[^#\s]*)?#(\S+)$/i;

/** The QR's text as one of our seals, or null. Regex, not URL: React Native's URL lacks `hash`. */
export function parseSeal(text: string): Parsed | null {
  const m = QR.exec(text.trim());
  if (!m) return null;
  const [, where, rawId, fragment] = m;
  const id = rawId.toLowerCase();
  const parts = fragment.split(".");
  if (parts.length === 1 && where.toLowerCase() === "sceau") return { type: "communique_legacy", id, signature: parts[0] };
  if (parts.length !== 3) return null;
  const [packed, signature, keyId] = parts;
  let message: string;
  try {
    message = fromUtf8(fromBase64(packed));
  } catch {
    return null;
  }
  return { type: where.toLowerCase() === "verifies" ? "verdict" : "communique", id, message, signature, keyId };
}

function verifies(publicKey: string, message: string, signature: string): boolean {
  try {
    // RFC 8032 strictness, like OpenSSL behind `cryptography` on the server.
    return ed.verify(fromBase64(signature), utf8(message), fromBase64(publicKey), { zip215: false });
  } catch {
    return false;
  }
}

function asPayload(message: string): Record<string, unknown> | null {
  try {
    const p: unknown = JSON.parse(message);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Check a scanned QR against the keys, revoked keys and registry kept on the phone. */
export function checkSeal(text: string, store: SealStore): SealResult {
  const parsed = parseSeal(text);
  if (!parsed) return { status: "not_seal", text };
  const kind = parsed.type === "verdict" ? "verdict" : "communique";
  const entry = store.registry.find((e) => e.id === parsed.id);
  const demo = !!entry?.is_demo;

  let message: string;
  let signature: string;
  let candidates: string[];
  if (parsed.type === "communique_legacy") {
    if (!entry) return { status: "not_cached", kind: "communique" };
    message = canonical(communiquePayload(entry));
    signature = parsed.signature;
    // The workspace registry names the key; the public feed does not, so try the issuer's keys.
    candidates = entry.sealed?.key_id
      ? [entry.sealed.key_id]
      : [...store.keys, ...store.revoked]
          .filter((k) => k.kind !== "verdict" && k.issuer === entry.issuer && (!entry.newsroom || k.newsroom.slug === entry.newsroom.slug))
          .map((k) => k.key_id);
  } else {
    message = parsed.message;
    signature = parsed.signature;
    candidates = [parsed.keyId];
  }

  const payload = asPayload(message);
  // Domain separation, as on the server: a verdict seal only for its own verdict page, and a
  // communiqué seal is never a verdict.
  const shapeOk =
    !!payload &&
    (kind === "verdict" ? payload.type === "verdict" && str(payload.id)?.toLowerCase() === parsed.id : payload.type === undefined && !!str(payload.issuer));
  if (!shapeOk) return { status: "mismatch", kind };

  const active = candidates.map((id) => store.keys.find((k) => k.key_id === id)).filter((k): k is PublicKey => !!k);
  const revoked = candidates.map((id) => store.revoked.find((k) => k.key_id === id)).filter((k): k is RevokedKey => !!k);
  const fits = (k: { kind?: string; issuer: string }) =>
    kind === "verdict" ? k.kind === "verdict" : k.kind !== "verdict" && k.issuer === payload.issuer;

  const key = active.find((k) => fits(k) && verifies(k.public_key, message, signature));
  if (!key) {
    // A revoked key's public half is not kept: whatever it signed is refused, as revoked. An older
    // QR names no key: with an active key of that issuer failing too, it is a mismatch.
    const r = revoked.find(fits);
    if (r && !active.length) return { status: "revoked", kind, signer: r.issuer, newsroom: r.newsroom, revokedAt: r.revoked_at };
    return active.length || revoked.length ? { status: "mismatch", kind } : { status: "unknown_issuer", kind };
  }

  const fields: SignedFields =
    kind === "verdict"
      ? { title: str(payload.title) ?? "", verdict: str(payload.verdict) ?? undefined, ref: str(payload.ref), date: str(payload.signed_at) }
      : { title: str(payload.title) ?? "", issuer: str(payload.issuer) ?? undefined, number: str(payload.number), date: str(payload.issued_on) };
  return { status: "authentic", kind, fields, signer: key.issuer, newsroom: key.newsroom, demo };
}

/** « vérification 145 » for FAN-0145 (`seal.check_number`). */
export function checkNumber(ref: string | null | undefined): number | null {
  const m = /(\d{1,8})$/.exec(String(ref ?? "").trim());
  return m ? Number(m[1]) : null;
}
