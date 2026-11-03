import { View } from "react-native";

import { Chip, styles, T } from "@/components/ui";
import { LANGS, NAMES, setLang, useLang, useT } from "@/lib/i18n";

/** The interface language in one tap. Each language is named in itself, so anyone finds theirs. */
export function LanguagePicker({ label = true }: { label?: boolean }) {
  const t = useT();
  const lang = useLang();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t.lang.hint} style={{ gap: 8 }}>
      {label && <T tone="label">{t.lang.title}</T>}
      <View style={styles.wrap}>
        {LANGS.map((l) => (
          <Chip key={l} label={NAMES[l]} selected={l === lang} onPress={() => setLang(l)} />
        ))}
      </View>
    </View>
  );
}
