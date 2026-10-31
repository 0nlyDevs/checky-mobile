import { useColorScheme } from "react-native";

import type { Verdict } from "@/lib/types";

// "Grille d'antenne" tokens, copied from the web desk (apps/web/app/globals.css, DESIGN.md).
// Signal yellow is only for "maintenant", focus and selection — never buttons, verdicts or status.
const light = {
  background: "#f4f6f5",
  foreground: "#14201d",
  card: "#ffffff",
  primary: "#141210",
  primaryForeground: "#f4efe4",
  muted: "#e9eeec",
  mutedForeground: "#4b5a56",
  accent: "#e2ebe8",
  border: "#c9d3d0",
  input: "#b4c0bc",
  destructive: "#b8352b",
  rail: "#141210",
  railForeground: "#efe4c8",
  railMuted: "#b3a686",
  manila: "#dcc9a3",
  signal: "#f2c230",
  signalInk: "#7a5900",
  verdict: {
    true: { fill: "#267a42", on: "#ffffff", soft: "#e2f1e6", ink: "#1f6b38" },
    misleading: { fill: "#c98a12", on: "#14201d", soft: "#f8ecd2", ink: "#7d5300" },
    false: { fill: "#c43d32", on: "#ffffff", soft: "#f8e1de", ink: "#9c2b22" },
    unverifiable: { fill: "#66716c", on: "#ffffff", soft: "#e7ebe9", ink: "#4f5a56" },
  } as Record<Verdict, { fill: string; on: string; soft: string; ink: string }>,
};

const dark: typeof light = {
  background: "#0d1614",
  foreground: "#e3ebe8",
  card: "#13201d",
  primary: "#dcc9a3",
  primaryForeground: "#141210",
  muted: "#18251f",
  mutedForeground: "#9aaba6",
  accent: "#1d302b",
  border: "#26372f",
  input: "#33473f",
  destructive: "#e0675c",
  rail: "#0e0d0b",
  railForeground: "#e6dcc2",
  railMuted: "#a39776",
  manila: "#dcc9a3",
  signal: "#f2c230",
  signalInk: "#f2c230",
  verdict: {
    true: { fill: "#3fae64", on: "#0d1614", soft: "#143323", ink: "#7fd69b" },
    misleading: { fill: "#dda233", on: "#0d1614", soft: "#352a12", ink: "#f0c56d" },
    false: { fill: "#e0675c", on: "#0d1614", soft: "#3a1b18", ink: "#f3a199" },
    unverifiable: { fill: "#8d9893", on: "#0d1614", soft: "#222c29", ink: "#bcc6c2" },
  },
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const fonts = {
  body: "PublicSans_400Regular",
  medium: "PublicSans_500Medium",
  semibold: "PublicSans_600SemiBold",
  bold: "PublicSans_700Bold",
  // Hours, durations and FAN refs.
  tabular: "BarlowCondensed_600SemiBold",
  // Page titles, as in the desk's shell.
  title: "Anton_400Regular",
};

export const radius = 5;
