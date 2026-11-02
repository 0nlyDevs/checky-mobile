import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "@/lib/icons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import useSWR from "swr";

import { Button, Chip, Field, Notice, Screen, T, styles } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { pickUp } from "@/lib/handoff";
import { t } from "@/lib/i18n/fr";
import { type Newsroom, publicApi, publicFetcher, rememberTip } from "@/lib/public";
import { useTheme } from "@/lib/theme";
import type { Origin } from "@/lib/types";

const ORIGINS: Origin[] = ["whatsapp", "facebook", "tiktok", "radio", "press", "other"];

/** PaperPlaneTilt a tip to a newsroom; its follow-up link is remembered on this phone. */
export default function Report() {
  const c = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const job = pickUp(id);
  const { data: newsrooms } = useSWR<Newsroom[]>("/newsrooms", publicFetcher);
  const [newsroom, setNewsroom] = useState<string | null>(null);
  const [text, setText] = useState(job?.text ?? "");
  const [url, setUrl] = useState(job?.url ?? "");
  const [origin, setOrigin] = useState<Origin>("whatsapp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = newsroom ?? (newsrooms?.length === 1 ? newsrooms[0].slug : null);

  async function send() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const out = await publicApi<{ token: string; ref: string }>("/tips", {
        method: "POST",
        body: JSON.stringify({ newsroom: chosen, text: text.trim(), url: url.trim() || null, origin }),
      });
      await rememberTip({
        token: out.token,
        ref: out.ref,
        title: text.trim().slice(0, 120) || url.trim(),
        newsroom: newsrooms?.find((n) => n.slug === chosen)?.name ?? chosen,
        at: new Date().toISOString(),
      });
      router.replace({ pathname: "/citoyen/suivi/[token]", params: { token: out.token } });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? t.tip.tooMany : t.tip.failed);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.cancel} onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="title">{t.tip.title}</T>
      </View>
      <T tone="muted">{t.tip.lead}</T>
      <View style={{ gap: 8 }}>
        <T tone="label">{t.tip.newsroom}</T>
        {newsrooms && newsrooms.length === 0 ? (
          <Notice>{t.tip.noNewsroom}</Notice>
        ) : (
          <View style={styles.wrap}>
            {(newsrooms ?? []).map((n) => (
              <Chip key={n.slug} label={n.name} selected={chosen === n.slug} onPress={() => setNewsroom(n.slug)} />
            ))}
          </View>
        )}
      </View>
      <Field label={t.tip.text} value={text} onChangeText={setText} multiline style={{ minHeight: 110, textAlignVertical: "top" }} />
      <Field label={t.tip.url} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
      <View style={{ gap: 8 }}>
        <T tone="label">{t.tip.origin}</T>
        <View style={styles.wrap}>
          {ORIGINS.map((o) => (
            <Chip key={o} label={t.origin[o]} selected={origin === o} onPress={() => setOrigin(o)} />
          ))}
        </View>
      </View>
      {error && <Notice tone="error">{error}</Notice>}
      <Button label={t.tip.send} busy={busy} disabled={!chosen || text.trim().length < 3} onPress={send} />
    </Screen>
  );
}
