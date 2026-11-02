import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT } from "@/components/tab-bar";
import { Sparkle } from "@/lib/icons";
import { t } from "@/lib/i18n/fr";
import { useTheme } from "@/lib/theme";

/** Floats above the tab bar at the right: opens Analyser and puts the cursor in its paste field. */
export function CheckyButton() {
  const c = useTheme();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.tabs.checky}
      onPress={() => router.navigate({ pathname: "/", params: { focus: String(Date.now()) } })}
      style={({ pressed }) => ({
        position: "absolute",
        right: 16,
        bottom: TAB_BAR_HEIGHT + bottom + 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.primary,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      })}
    >
      <Sparkle size={26} color={c.primaryForeground} />
    </Pressable>
  );
}
