import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "@/lib/icons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import useSWR from "swr";

import { Button, Chip, Field, Notice, Screen, T, styles } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { pickUp } from "@/lib/handoff";
import { useT } from "@/lib/i18n";
import { deviceCountry, type Newsroom, publicApi, publicFetcher, rememberTip } from "@/lib/public";
import { useTheme } from "@/lib/theme";
import type { components } from "@/lib/api-schema";
import type { Origin } from "@/lib/types";
import { goBack } from "@/lib/nav";

type Schemas = components["schemas"];

type TipOut = Schemas["TipOut"];

const ORIGINS: Origin[] = ["whatsapp", "facebook", "tiktok", "radio", "press", "other"];

/** Send a tip to a newsroom, or let Checky route it by place and country; its follow-up link is
 * remembered on this phone. */
export default function Report() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const job = pickUp(id);
  const { data: newsrooms } = useSWR<Newsroom[]>("/newsrooms", publicFetcher);
  // null = « Je ne sais pas : Checky choisit » (the API routes it by place, then country).
  const [newsroom, setNewsroom] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [text, setText] = useState(job?.text ?? "");
  const [url, setUrl] = useState(job?.url ?? "");
  const [origin, setOrigin] = useState<Origin>("whatsapp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = text.trim().length >= 5;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const out = await publicApi<TipOut>("/tips", {
        method: "POST",
        body: JSON.stringify({
          newsroom,
          text: text.trim(),
          url: url.trim() || null,
          origin,
          place: newsroom ? null : place.trim() || null,
          country: deviceCountry(),
        }),
      });
      const name = out.newsroom?.name ?? newsrooms?.find((n) => n.slug === newsroom)?.name ?? t.app.name;
      await rememberTip({ token: out.token, ref: out.ref, title: text.trim().slice(0, 120) || url.trim(), newsroom: name, at: new Date().toISOString() });
      router.replace({ pathname: "/citoyen/suivi/[token]", params: { token: out.token, routed: out.routed ?? "chosen" } });
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429 ? t.tip.tooMany : e instanceof ApiError && e.status === 404 ? t.tip.noNewsroom : t.tip.failed,
      );
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={goBack} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="title">{t.tip.title}</T>
      </View>
      <T tone="muted">{t.tip.lead}</T>
      <View style={{ gap: 8 }}>
        <T tone="label">{t.tip.newsroom}</T>
        <View style={styles.wrap}>
          <Chip label={t.tip.auto} selected={!newsroom} onPress={() => setNewsroom(null)} />
          {(newsrooms ?? []).map((n) => (
            <Chip key={n.slug} label={n.name} selected={newsroom === n.slug} onPress={() => setNewsroom(n.slug)} />
          ))}
        </View>
      </View>
      {!newsroom && (
        <View style={{ gap: 4 }}>
          <Field label={t.tip.place} value={place} onChangeText={(v) => setPlace(v.slice(0, 120))} autoCapitalize="words" />
          <T tone="muted">{t.tip.placeHint}</T>
        </View>
      )}
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
      <Button label={t.tip.send} busy={busy} disabled={!ready} onPress={send} />
    </Screen>
  );
}
