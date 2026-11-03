// Pure (no React Native import): tested with node --test.

/** What is worth offering to check from the clipboard: a web link, or a sentence long enough to
 * carry a claim (not a code, a number or a word). */
export function worthOffering(s: string): "link" | "text" | null {
  const v = s.trim();
  if (/^https?:\/\/\S+$/i.test(v)) return "link";
  if (v.length < 24 || v.length > 6000) return null;
  return v.split(/\s+/).length >= 5 ? "text" : null;
}

/** A short fingerprint, so the phone remembers what it already offered without keeping the text. */
export function fingerprint(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

/** Keep a bounded list: copying A, then B, then A does not offer A a second time. */
export function rememberOffer(stored: string | null, print: string): string | null {
  let seen: string[];
  try {
    const value: unknown = JSON.parse(stored ?? "[]");
    seen = Array.isArray(value) ? value.filter((x): x is string => typeof x === "string").slice(-31) : [];
  } catch {
    seen = [];
  }
  if (seen.includes(print)) return null;
  return JSON.stringify([...seen, print]);
}
