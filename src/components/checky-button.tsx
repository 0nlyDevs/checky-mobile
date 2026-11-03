import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT } from "@/components/tab-bar";
import { Sparkle } from "@/lib/icons";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/** Floats at the bottom right, above the tab bar in the desk: opens the assistant, as on the web. */
export function CheckyButton({ tabs = true }: { tabs?: boolean }) {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.assistant.open}
      onPress={() => router.push("/assistant")}
      style={({ pressed }) => ({
        position: "absolute",
        right: 16,
        bottom: (tabs ? TAB_BAR_HEIGHT : 0) + bottom + 16,
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
