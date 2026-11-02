import { useColorScheme } from "react-native";

import { dark, light, type Palette } from "@/lib/tokens";

// Checky tokens live in tokens.ts (pure, tested); this file only picks the palette for the system scheme.
export type Theme = Palette;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const fonts = {
  regular: "BricolageGrotesque_400Regular",
  medium: "BricolageGrotesque_500Medium",
  semibold: "BricolageGrotesque_600SemiBold",
  bold: "BricolageGrotesque_700Bold",
  display: "BricolageGrotesque_800ExtraBold",
  // Verbatim quotations only.
  quote: "CormorantGaramond_500Medium_Italic",
};

// Spec 4.2: cards 20, controls and chips fully round, small tags 6.
export const radius = { card: 20, control: 999, tag: 6 } as const;

/** Title tracking, proportional to size: -0.03 em (spec 4.3 asks -0.02 to -0.04). Body stays 0. */
export const tracking = (size: number) => Math.round(size * -0.03 * 100) / 100;
