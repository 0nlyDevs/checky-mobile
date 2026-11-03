import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT } from "@/components/tab-bar";
import { useT } from "@/lib/i18n";
import { type Icon, Newspaper, PaperPlaneTilt, QrCode, Scan } from "@/lib/icons";
import { useMode } from "@/lib/mode";
import { fonts, useTheme } from "@/lib/theme";

type Tab = { path: string; also?: string[]; icon: Icon; key: "check" | "verdicts" | "report" | "scan" };

/** The public site's menu, on the phone: Vérifier, Les verdicts, Signaler, Scanner. */
const TABS: Tab[] = [
  { path: "/citoyen", also: ["/citoyen/verifier"], icon: Scan, key: "check" },
  { path: "/verdicts", icon: Newspaper, key: "verdicts" },
  { path: "/citoyen/signaler", icon: PaperPlaneTilt, key: "report" },
  { path: "/scanner", icon: QrCode, key: "scan" },
];

/** Whether the citizen's bar is on screen (citizen mode, on one of its four places). */
export function useCitizenBar(): boolean {
  const { mode } = useMode();
  const path = usePathname();
  return mode === "citizen" && TABS.some((tab) => tab.path === path || tab.also?.includes(path));
}

/** The ink bar of citizen mode, drawn like the desk's tab bar: the current place is a paper pill. */
export function CitizenBar() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const path = usePathname();
  const { bottom } = useSafeAreaInsets();
  if (!useCitizenBar()) return null;
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        gap: 4,
        backgroundColor: c.nav,
        height: TAB_BAR_HEIGHT + bottom,
        paddingBottom: bottom,
        paddingHorizontal: 8,
        alignItems: "center",
      }}
    >
      {TABS.map((tab) => {
        const selected = tab.path === path || !!tab.also?.includes(path);
        const color = selected ? c.navActiveForeground : c.navForeground;
        const label = t.citizenNav[tab.key];
        const Glyph = tab.icon;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => !selected && router.navigate(tab.path as never)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 50,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              backgroundColor: selected ? c.navActive : "transparent",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Glyph size={22} color={color} />
            <Text numberOfLines={1} style={{ fontFamily: selected ? fonts.semibold : fonts.medium, fontSize: 11.5, color }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
