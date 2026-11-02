import { T } from "@/components/ui";
import { t } from "@/lib/i18n/fr";
import { fonts, tracking, useTheme } from "@/lib/theme";

/** The wordmark is the mark (spec 4.1): Bricolage 800, the dot in Cormorant italic. */
export function Brand() {
  const c = useTheme();
  return (
    <T accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: tracking(28), color: c.foreground }}>
      {t.app.name}
      <T style={{ fontFamily: fonts.quote, fontSize: 28, lineHeight: 34, color: c.foreground }}>.</T>
    </T>
  );
}
