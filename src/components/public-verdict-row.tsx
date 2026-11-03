import { router } from "expo-router";
import { Pressable } from "react-native";

import { T, VerdictBadge } from "@/components/ui";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { PublicVerdict } from "@/lib/public";
import { fonts, radius, useTheme } from "@/lib/theme";
import type { Verdict } from "@/lib/types";

export function PublicVerdictRow({ v, n }: { v: PublicVerdict; n?: number }) {
  const t = useT();
  const c = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/citoyen/verdict/[id]", params: { id: v.id } })}
      accessibilityRole="link"
      style={({ pressed }) => ({ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.card, padding: 14, gap: 8, transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 })}
    >
      <VerdictBadge verdict={v.verdict as Verdict} />
      <T style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23 }} numberOfLines={3}>
        {n ? `[${n}] ` : ""}
        {v.title}
      </T>
      <T tone="muted">
        {t.citizen.by(v.newsroom.name)} · {t.citizen.published(ago(v.published_at))}
      </T>
    </Pressable>
  );
}
