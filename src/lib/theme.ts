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

export const radius = 5;
