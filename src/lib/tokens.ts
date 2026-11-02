// Checky tokens (spec 4.2). Pure data and maths: no react-native import, so it runs under `node --test`.
// Verdict type is repeated here for the same reason.
type VerdictKey = "true" | "misleading" | "false" | "unverifiable";
export type VerdictTone = { fill: string; on: string; soft: string; ink: string };

export type Palette = {
  background: string;
  foreground: string;
  card: string;
  raised: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  border: string;
  input: string;
  destructive: string;
  nav: string;
  navForeground: string;
  navActive: string;
  navActiveForeground: string;
  // Aliases kept until Task 4 replaces their users.
  rail: string;
  railForeground: string;
  railMuted: string;
  manila: string;
  signal: string;
  signalInk: string;
  verdict: Record<VerdictKey, VerdictTone>;
};

export const light: Palette = {
  background: "#f3f2ee",
  foreground: "#0a0a0b",
  card: "#fbfaf7",
  raised: "#e9e8e2",
  primary: "#0a0a0b",
  primaryForeground: "#f3f2ee",
  muted: "#e9e8e2",
  mutedForeground: "#55544e",
  accent: "#e2e1da",
  border: "rgba(10,10,11,0.10)",
  input: "#c4c3be",
  destructive: "#b3231a",
  nav: "#0a0a0b",
  navForeground: "#b9b8b2",
  navActive: "#f3f2ee",
  navActiveForeground: "#0a0a0b",
  rail: "#0a0a0b",
  railForeground: "#b9b8b2",
  railMuted: "#b9b8b2",
  manila: "#f3f2ee",
  signal: "#0a0a0b",
  signalInk: "#0a0a0b",
  verdict: {
    true: { fill: "#0b6b3a", on: "#ffffff", soft: "#e1f3e8", ink: "#0b6b3a" },
    misleading: { fill: "#8a5700", on: "#ffffff", soft: "#f9ecd2", ink: "#8a5700" },
    false: { fill: "#b3231a", on: "#ffffff", soft: "#fbe3e0", ink: "#b3231a" },
    unverifiable: { fill: "#1d58c4", on: "#ffffff", soft: "#e0eafb", ink: "#1d58c4" },
  },
};

export const dark: Palette = {
  background: "#0a0a0b",
  foreground: "#f3f2ee",
  card: "#111113",
  raised: "#19191c",
  primary: "#f3f2ee",
  primaryForeground: "#0a0a0b",
  muted: "#19191c",
  mutedForeground: "#a6a5a0",
  accent: "#232327",
  border: "rgba(243,242,238,0.10)",
  input: "#3a3a3c",
  destructive: "#ff6a5f",
  nav: "#1c1c1f",
  navForeground: "#b4b3ad",
  navActive: "#f3f2ee",
  navActiveForeground: "#0a0a0b",
  rail: "#1c1c1f",
  railForeground: "#b4b3ad",
  railMuted: "#b4b3ad",
  manila: "#f3f2ee",
  signal: "#f3f2ee",
  signalInk: "#f3f2ee",
  verdict: {
    true: { fill: "#3ddc84", on: "#0a0a0b", soft: "#0f2219", ink: "#3ddc84" },
    misleading: { fill: "#ffb224", on: "#0a0a0b", soft: "#29200c", ink: "#ffb224" },
    false: { fill: "#ff4a3d", on: "#0a0a0b", soft: "#2a1311", ink: "#ff6a5f" },
    unverifiable: { fill: "#3b8cff", on: "#0a0a0b", soft: "#101a2b", ink: "#6aa8ff" },
  },
};

/** Text colour / background colour pairs that must stay readable (>= 4.5:1). Entries are "path" strings
 * resolved against a palette, e.g. "verdict.true.ink". */
export const PAIRS: readonly [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "muted"],
  ["mutedForeground", "background"],
  ["mutedForeground", "card"],
  ["mutedForeground", "muted"],
  ["primaryForeground", "primary"],
  ["navForeground", "nav"],
  ["navActiveForeground", "navActive"],
  ...(["true", "misleading", "false", "unverifiable"] as const).flatMap((v): [string, string][] => [
    [`verdict.${v}.ink`, `verdict.${v}.soft`],
    [`verdict.${v}.ink`, "background"],
    [`verdict.${v}.on`, `verdict.${v}.fill`],
  ]),
];

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
