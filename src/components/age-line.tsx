import { CloudSlash } from "@/lib/icons";
import { View } from "react-native";

import { T } from "@/components/ui";
import { stamp } from "@/lib/format";
import { t } from "@/lib/i18n/fr";
import { useOnline } from "@/lib/network";
import { useTheme } from "@/lib/theme";

/** The age of a set kept on the phone, always shown on the offline reading screens:
 * « Données du 3 nov., 07:12 », or « Hors connexion · données du … » with no network. */
export function AgeLine({ at }: { at: number | null | undefined }) {
  const c = useTheme();
  const online = useOnline();
  if (!at) return <T tone="muted">{t.offline.never}</T>;
  return (
    <View accessibilityRole={online ? undefined : "alert"} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {!online && <CloudSlash size={16} color={c.foreground} />}
      <T tone="muted" style={{ flex: 1, color: online ? c.mutedForeground : c.foreground }}>
        {online ? t.offline.savedAt(stamp(at)) : t.offline.age(stamp(at))}
      </T>
    </View>
  );
}
