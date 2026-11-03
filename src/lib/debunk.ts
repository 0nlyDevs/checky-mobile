// Pure (no React Native import): tested with node --test.

/** What a published verdict carries that the démenti needs (`VerdictOut` of the public API). */
export type Signed = { title: string; reason: string | null; post: string | null; newsroom: { name: string } };

const MAX = 600;

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…`;
}

/** « Remplacer par le démenti »: the text that takes the rumour's place in a message being
 * written. Only a verdict a newsroom signed and published (never a reading): its post, or else
 * its word and reason, then who verified it and the link to the proof. */
export function debunkText(v: Signed, verdictWord: string, link: string, by: (newsroom: string) => string): string {
  const body = v.post?.trim() ? clip(v.post, MAX) : clip(`${verdictWord} : ${v.title}. ${v.reason ?? ""}`, MAX);
  return `${body}\n${by(v.newsroom.name)} : ${link}`;
}
