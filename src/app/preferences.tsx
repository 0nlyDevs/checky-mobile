import { LanguagePicker } from "@/components/language-picker";
import { LightSwitch } from "@/components/light";
import { Screen, Section, T } from "@/components/ui";
import { useT } from "@/lib/i18n";

/** Visitor preferences stay reachable from the menu, without looking below a long feed. */
export default function Preferences() {
  const t = useT();
  return <Screen><T tone="title">{t.navigation.account}</T><Section title={t.lang.title}><LanguagePicker label={false} /></Section><LightSwitch /></Screen>;
}
