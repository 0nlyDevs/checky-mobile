import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "@/lib/icons";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useSWR from "swr";

import { PublicVerdictRow } from "@/components/public-verdict-row";
import { Card, Notice, Section, Step, T, styles } from "@/components/ui";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useLight } from "@/lib/light";
import { publicFetcher, type TipStatus } from "@/lib/public";
import { fonts, useTheme } from "@/lib/theme";

const ORDER = ["to_check", "in_progress", "verified", "published"];

/** Where a citizen's tip stands, refreshed every 30 s; its verdict once published. */
export default function FollowTip() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const { token, routed } = useLocalSearchParams<{ token: string; routed?: string }>();
  // How Checky chose the newsroom, said once, right after sending (only known keys are shown).
  const how = routed && Object.hasOwn(t.tip.routed, routed) ? t.tip.routed[routed] : undefined;
  const { light } = useLight();
  const { data, error, isLoading, mutate } = useSWR<TipStatus>(`/tips/${token}`, publicFetcher, { refreshInterval: light ? 120_000 : 30_000 });
  const reached = data ? ORDER.indexOf(data.status) : -1;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={isLoading && !!data} onRefresh={() => void mutate()} />}>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/citizen"))} hitSlop={12} style={{ padding: 4 }}>
            <ArrowLeft size={24} color={c.foreground} />
          </Pressable>
          <T tone="title" style={{ flex: 1 }}>
            {t.follow.title}
          </T>
          {data?.ref && <T tone="tabular">{data.ref}</T>}
        </View>
        {error && <Notice tone="error">{t.follow.unknown}</Notice>}
        {data && (
          <>
            <T style={{ fontFamily: fonts.semibold, fontSize: 18 }}>{data.title}</T>
            <T tone="muted">
              {data.newsroom.name} · {t.follow.received(ago(data.received_at))}
            </T>
            {how && <Notice>{how(data.newsroom.name)}</Notice>}
            <Card>
              {ORDER.map((s, i) => (
                <Step key={s} label={t.follow.steps[s]} state={i < reached || (i === reached && s === "published") ? "done" : i === reached ? "running" : "waiting"} />
              ))}
            </Card>
            <Section title={t.follow.verdict}>{data.verdict ? <PublicVerdictRow v={data.verdict} /> : <T tone="muted">{t.follow.waiting}</T>}</Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
