import { View } from "react-native";

import { Card, T, styles } from "@/components/ui";
import { day } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Clock } from "@/lib/icons";
import type { Figure } from "@/lib/offline";
import { fonts, useTheme } from "@/lib/theme";

/** An official figure with its date, source and, when it is old, a word saying so. */
export function FigureCard({ f }: { f: Pick<Figure, "label" | "value" | "unit" | "as_of" | "source_name" | "old" | "is_demo"> & { as_of_label?: string } }) {
  const t = useT();
  const c = useTheme();
  return (
    <Card style={{ gap: 4 }}>
      <T tone="label">{f.label}</T>
      <T tone="tabular" style={{ fontSize: 22, lineHeight: 28 }}>
        {f.value}
        {f.unit ? ` ${f.unit}` : ""}
      </T>
      <T tone="muted">{[f.as_of_label || day(f.as_of), t.figures.source(f.source_name), f.is_demo ? t.offline.demo : ""].filter(Boolean).join(" · ")}</T>
      {f.old && (
        <View style={styles.row}>
          <Clock size={15} color={c.foreground} />
          <T style={{ fontSize: 14, fontFamily: fonts.medium }}>{t.figures.old}</T>
        </View>
      )}
    </Card>
  );
}
