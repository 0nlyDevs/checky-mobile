import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { T } from "@/components/ui";
import { t } from "@/lib/i18n/fr";
import { fonts, useTheme } from "@/lib/theme";

/** The folder logo (apps/web/public/logo.svg) and the name. */
export function Brand() {
  const c = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Svg width={36} height={36} viewBox="0 0 64 64" accessibilityElementsHidden>
        <Rect width={64} height={64} rx={10} fill="#dcc9a3" />
        <Path d="M12 22h14l4-6h22v34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z" fill="#141210" />
        <Rect x={19} y={31} width={26} height={9} rx={1.5} fill="none" stroke="#c42a20" strokeWidth={3} transform="rotate(-9 32 35.5)" />
      </Svg>
      <T style={{ fontFamily: fonts.title, fontSize: 28, lineHeight: 34, letterSpacing: 1, color: c.foreground }}>{t.app.name}</T>
    </View>
  );
}
