import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Image as ImageIcon, Share2 } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, Share, useWindowDimensions, View } from "react-native";
import useSWR from "swr";

import { Button, Card, Notice, Screen, Section, T, VerdictBadge, styles } from "@/components/ui";
import { type CardRef, shareCard, VerdictCardView } from "@/components/verdict-card";
import { ago } from "@/lib/format";
import { t } from "@/lib/i18n/fr";
import { publicFetcher, type PublicVerdict, verdictLink } from "@/lib/public";
import { fonts, useTheme } from "@/lib/theme";
import type { Verdict } from "@/lib/types";

/** A published verdict, as the newsroom wrote it, to read and pass on. */
export default function PublicVerdictScreen() {
  const c = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: v, error } = useSWR<PublicVerdict>(`/verdicts/${id}`, publicFetcher);
  const cardRef: CardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  if (error) {
    return (
      <Screen>
        <Notice tone="error">{t.citizen.failed}</Notice>
      </Screen>
    );
  }
  if (!v) {
    return (
      <Screen>
        <T tone="muted">{t.common.loading}</T>
      </Screen>
    );
  }
  const verdict = v.verdict as Verdict;
  const text = v.post || v.reason || "";

  return (
    <Screen>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.cancel} onPress={() => (router.canGoBack() ? router.back() : router.replace("/citoyen"))} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {v.ref && <T tone="tabular">{v.ref}</T>}
      </View>
      <VerdictBadge verdict={verdict} large />
      <T style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 29 }}>{v.title}</T>
      <T tone="muted">
        {t.citizen.by(v.newsroom.name)} · {t.citizen.published(ago(v.published_at))}
      </T>
      {!!v.reason && (
        <Section title={t.citizen.reason}>
          <T>{v.reason}</T>
        </Section>
      )}
      {!!v.post && v.post !== v.reason && (
        <Card>
          <T style={{ fontFamily: fonts.quote, fontSize: 17, lineHeight: 24 }}>{v.post}</T>
        </Card>
      )}
      {v.sources.length > 0 && (
        <Section title={t.citizen.sources}>
          {v.sources.map((s, i) => (
            <T key={i}>· {s}</T>
          ))}
        </Section>
      )}
      <Section title={t.citizen.share}>
        <VerdictCardView width={width - 32} cardRef={cardRef} verdict={verdict} title={v.title} reason={(v.reason ?? "").slice(0, 280)} sources={v.sources} refLabel={v.ref} desk={v.newsroom.name} lang="fr" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label={t.citizen.shareCard}
            icon={ImageIcon}
            busy={sharing}
            style={{ flex: 1 }}
            onPress={async () => {
              setSharing(true);
              await shareCard(cardRef, t.citizen.share).catch(() => null);
              setSharing(false);
            }}
          />
          <Button
            label={t.card.shareText}
            icon={Share2}
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => Share.share({ message: t.citizen.shareText(t.verdict[verdict], v.title, v.newsroom.name, text, verdictLink(v.id)) })}
          />
        </View>
      </Section>
    </Screen>
  );
}
