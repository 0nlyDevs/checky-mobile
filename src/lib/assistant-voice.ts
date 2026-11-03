/** Citations stay visible on screen but are not read as bracket codes. */
export function speechExcerpt(answer: string, max: number): { text: string; clipped: boolean } {
  const clean = answer.replace(/\[\d+(?:\s*,\s*\d+)*\]|【[^】]*】|\*\*/g, "").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  if (clean.length <= max) return { text: clean, clipped: false };
  const prefix = clean.slice(0, max);
  const end = prefix.lastIndexOf(" ");
  return { text: (end > max / 2 ? prefix.slice(0, end) : prefix).trim(), clipped: true };
}
