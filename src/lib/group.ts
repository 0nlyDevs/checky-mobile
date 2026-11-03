// Pure (no React Native import): tested with node --test.

/** One screenshot of a batch, once checked: what tells two screenshots carry the same rumour. */
export type Shot = {
  /** Same file bytes. */
  sha256?: string | null;
  /** 64-bit difference hash of the picture (16 hex, `file.meta.dhash`): a re-saved or recropped copy stays close. */
  dhash?: string | null;
  /** The desk already follows it (link check `tracked`). */
  trackedId?: string | null;
  /** The main claim, or the text read from it. */
  text?: string | null;
};

/** Spec: « share ten screenshots from the gallery ». */
export const MAX_BATCH = 10;

export type Link = "same_file" | "same_picture" | "same_claim" | "same_words";
export type Group = { members: number[]; links: Link[] };

/** Bits that differ between two 16-hex difference hashes; null when either is missing. */
export function hamming(a?: string | null, b?: string | null): number | null {
  if (!a || !b || a.length !== b.length || !/^[0-9a-f]+$/i.test(a + b)) return null;
  let d = 0;
  for (let i = 0; i < a.length; i += 4) {
    let x = parseInt(a.slice(i, i + 4), 16) ^ parseInt(b.slice(i, i + 4), 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Same rumour at ≤ 10 bits of 64: crops, recompression and status bars change a few. */
export const PICTURE_BITS = 10;

function words(s?: string | null): Set<string> {
  return new Set(
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4),
  );
}

/** Two claims say the same thing when most words of the shorter one are in the other. */
export function sameWords(a?: string | null, b?: string | null): boolean {
  const A = words(a);
  const B = words(b);
  const small = Math.min(A.size, B.size);
  if (small < 3) return false;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared >= 3 && shared / small >= 0.6;
}

function link(a: Shot, b: Shot): Link | null {
  if (a.sha256 && a.sha256 === b.sha256) return "same_file";
  if (a.trackedId && a.trackedId === b.trackedId) return "same_claim";
  const d = hamming(a.dhash, b.dhash);
  if (d !== null && d <= PICTURE_BITS) return "same_picture";
  if (sameWords(a.text, b.text)) return "same_words";
  return null;
}

/** « Plusieurs captures d'un coup »: screenshots grouped by rumour (union of every pair that
 * shares a file, a picture, a followed claim or its words). Largest groups first, then in the
 * order the screenshots came. */
export function groupByRumour(shots: Shot[]): Group[] {
  const parent = shots.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const links = new Map<number, Set<Link>>();
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const l = link(shots[i], shots[j]);
      if (!l) continue;
      const [ri, rj] = [find(i), find(j)];
      const merged = new Set([...(links.get(ri) ?? []), ...(links.get(rj) ?? []), l]);
      parent[rj] = ri;
      links.delete(rj);
      links.set(ri, merged);
    }
  }
  const groups = new Map<number, number[]>();
  shots.forEach((_, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), i]);
  });
  return [...groups.entries()]
    .map(([r, members]) => ({ members, links: [...(links.get(r) ?? [])] }))
    .sort((a, b) => b.members.length - a.members.length || a.members[0] - b.members[0]);
}
