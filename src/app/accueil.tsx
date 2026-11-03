import { CaretRight, type Icon, MagnifyingGlass, Newspaper } from "@/lib/icons";
import { Pressable, View } from "react-native";

import { Brand } from "@/components/brand";
import { LanguagePicker } from "@/components/language-picker";
import { Screen, T } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { type Mode, useMode } from "@/lib/mode";
import { fonts, radius, useTheme } from "@/lib/theme";

/** First launch: a citizen checking something, or a journalist going to the desk. */
export default function Start() {
  const t = useT();
  const { setMode } = useMode();
  // Once a mode is set this screen is no longer allowed, and the root stack opens the right side.
  const pick = (mode: Mode) => setMode(mode);
  return (
    <Screen contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 24 }}>
      <Brand />
      <LanguagePicker />
      <T tone="title">{t.app.tagline}</T>
      <T tone="muted">{t.start.lead}</T>
      <Choice icon={MagnifyingGlass} title={t.start.citizen} hint={t.start.citizenHint} primary onPress={() => pick("citizen")} />
      <Choice icon={Newspaper} title={t.start.journalist} hint={t.start.journalistHint} onPress={() => pick("journalist")} />
    </Screen>
  );
}

function Choice({ icon: Icon, title, hint, primary, onPress }: { icon: Icon; title: string; hint: string; primary?: boolean; onPress: () => void }) {
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
        borderRadius: radius.card,
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
      <CaretRight size={22} color={fg} />
    </Pressable>
  );
}
