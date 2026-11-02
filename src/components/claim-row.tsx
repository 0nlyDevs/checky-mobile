import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { StatusLabel, T, VerdictBadge } from "@/components/ui";
import { span } from "@/lib/format";
import { t } from "@/lib/i18n/fr";
import { fonts, radius, useTheme } from "@/lib/theme";
import type { ClaimData, Item } from "@/lib/types";

export function ClaimRow({ item }: { item: Item }) {
  const c = useTheme();
  const d = item.data as ClaimData;
  const verdict = d.verdict ?? null;
  const suggested = !verdict ? (d.verdict_suggested ?? null) : null;
  return (
    <Link href={{ pathname: "/affirmation/[id]", params: { id: item.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => ({ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.card, padding: 14, gap: 8, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <T tone="tabular" style={{ color: c.mutedForeground }}>
            {d.ref ?? "—"}
            {d.first_seen_at ? `  ·  ${t.claims.since(span(d.first_seen_at))}` : ""}
          </T>
          <StatusLabel status={item.status} />
        </View>
        <T style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23 }} numberOfLines={3}>
          {item.title}
        </T>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {verdict ? <VerdictBadge verdict={verdict} /> : suggested ? <VerdictBadge verdict={suggested} suggested /> : <T tone="muted">{t.verdict.none}</T>}
          <T tone="muted">{t.claims.sources(d.source_count ?? 0)}</T>
        </View>
      </Pressable>
    </Link>
  );
}
