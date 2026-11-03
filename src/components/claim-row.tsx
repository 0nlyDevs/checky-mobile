import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { StatusLabel, T, VerdictBadge } from "@/components/ui";
import { span } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { fonts, radius, useTheme } from "@/lib/theme";
import type { ClaimData, Item } from "@/lib/types";

export function ClaimRow({ item, compact = false }: { item: Item; compact?: boolean }) {
  const t = useT();
  const c = useTheme();
  const d = item.data as ClaimData;
  const verdict = d.verdict ?? null;
  const suggested = !verdict ? (d.verdict_suggested ?? null) : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/affirmation/[id]", params: { id: item.id } })}
      accessibilityRole="button"
      style={({ pressed }) => ({ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.card, padding: compact ? 20 : 18, gap: 14, minHeight: compact ? 220 : undefined, transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <T tone="tabular" style={{ color: c.mutedForeground, flex: 1, fontSize: 12 }}>
          {d.ref ?? "—"}
          {d.first_seen_at ? `  ·  ${t.claims.since(span(d.first_seen_at))}` : ""}
        </T>
        <StatusLabel status={item.status} />
      </View>
      <T style={{ fontFamily: fonts.bold, fontSize: compact ? 21 : 18, lineHeight: compact ? 28 : 25 }} numberOfLines={compact ? 4 : 3}>
        {item.title}
      </T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {verdict ? <VerdictBadge verdict={verdict} /> : suggested ? <VerdictBadge verdict={suggested} suggested /> : <T tone="muted">{t.verdict.none}</T>}
        <T tone="muted">{t.claims.sources(d.source_count ?? 0)}</T>
      </View>
    </Pressable>
  );
}
