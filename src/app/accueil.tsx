import { ChevronRight, type LucideIcon, Newspaper, SearchCheck } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Brand } from "@/components/brand";
import { Screen, T } from "@/components/ui";
import { t } from "@/lib/i18n/fr";
import { type Mode, useMode } from "@/lib/mode";
import { fonts, radius, useTheme } from "@/lib/theme";

/** First launch: a citizen checking something, or a journalist going to the desk. */
export default function Start() {
  const { setMode } = useMode();
  // Once a mode is set this screen is no longer allowed, and the root stack opens the right side.
  const pick = (mode: Mode) => setMode(mode);
  return (
    <Screen contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 24 }}>
      <Brand />
      <T tone="title">{t.app.tagline}</T>
      <T tone="muted">{t.start.lead}</T>
      <Choice icon={SearchCheck} title={t.start.citizen} hint={t.start.citizenHint} primary onPress={() => pick("citizen")} />
      <Choice icon={Newspaper} title={t.start.journalist} hint={t.start.journalistHint} onPress={() => pick("journalist")} />
    </Screen>
  );
}

function Choice({ icon: Icon, title, hint, primary, onPress }: { icon: LucideIcon; title: string; hint: string; primary?: boolean; onPress: () => void }) {
  const c = useTheme();
  const fg = primary ? c.primaryForeground : c.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 18,
        borderRadius: radius,
        backgroundColor: primary ? c.primary : c.card,
        borderWidth: primary ? 0 : 1,
        borderColor: c.input,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon size={26} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ color: fg, fontFamily: fonts.semibold, fontSize: 18 }}>{title}</T>
        <T style={{ color: primary ? c.primaryForeground : c.mutedForeground, fontSize: 14, opacity: 1 }}>{hint}</T>
      </View>
      <ChevronRight size={22} color={fg} />
    </Pressable>
  );
}
