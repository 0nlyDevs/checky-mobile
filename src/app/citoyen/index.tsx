import * as Clipboard from "expo-clipboard";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { CaretRight, ClipboardText, ShareNetwork } from "@/lib/icons";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import useSWR from "swr";

import { PublicVerdictRow } from "@/components/public-verdict-row";
import { Brand } from "@/components/brand";
import { Button, Card, Field, Screen, Section, T } from "@/components/ui";
import { ago } from "@/lib/format";
import { handOff } from "@/lib/handoff";
import { t } from "@/lib/i18n/fr";
import { useMode } from "@/lib/mode";
import { type MyTip, myTips, publicFetcher } from "@/lib/public";
import { fonts, useTheme } from "@/lib/theme";

type Page = { items: import("@/lib/public").PublicVerdict[]; total: number };

/** The citizen's home: paste or share something, see the latest published verdicts and one's own tips. */
export default function CitizenHome() {
  const c = useTheme();
  const router = useRouter();
  const { setMode } = useMode();
  const [text, setText] = useState("");
  const [tips, setTips] = useState<MyTip[]>([]);
  const { data: latest } = useSWR<Page>("/verdicts?limit=5", publicFetcher);

  useFocusEffect(
    useCallback(() => {
      myTips().then(setTips);
    }, []),
  );

  function check() {
    const s = text.trim();
    if (!s) return;
    const isUrl = /^https?:\/\/\S+$/i.test(s);
    router.push({ pathname: "/citoyen/verifier", params: { id: handOff(isUrl ? { url: s } : { text: s }) } });
  }

  return (
    <Screen>
      <Brand />
      <View style={{ gap: 6 }}>
        <T tone="title">{t.citizen.title}</T>
        <T tone="muted">{t.citizen.lead}</T>
      </View>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.muted, borderColor: c.muted }}>
        <ShareNetwork size={20} color={c.foreground} />
        <T style={{ flex: 1, fontSize: 15 }}>{t.citizen.shareHint}</T>
      </Card>
      <Field placeholder={t.citizen.placeholder} value={text} onChangeText={setText} multiline style={{ minHeight: 96, textAlignVertical: "top" }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={t.citizen.paste} icon={ClipboardText} variant="outline" style={{ flex: 1 }} onPress={async () => setText((await Clipboard.getStringAsync()).trim())} />
        <Button label={t.citizen.check} style={{ flex: 1 }} disabled={!text.trim()} onPress={check} />
      </View>

      {tips.length > 0 && (
        <Section title={t.citizen.mine}>
          {tips.map((tip) => (
            <Link key={tip.token} href={{ pathname: "/citoyen/suivi/[token]", params: { token: tip.token } }} asChild>
              <Pressable accessibilityRole="link">
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T tone="tabular">{tip.ref}</T>
                    <T numberOfLines={2} style={{ fontFamily: fonts.medium }}>
                      {tip.title}
                    </T>
                    <T tone="muted">
                      {tip.newsroom} · {ago(tip.at)}
                    </T>
                  </View>
                  <CaretRight size={20} color={c.foreground} />
                </Card>
              </Pressable>
            </Link>
          ))}
        </Section>
      )}

      <Section title={t.citizen.latest}>
        {latest?.items.length ? latest.items.map((v) => <PublicVerdictRow key={v.id} v={v} />) : <T tone="muted">{t.citizen.noLatest}</T>}
      </Section>

      <Button
        label={t.citizen.journalist}
        variant="ghost"
        onPress={() => {
          setMode("journalist");
          router.replace("/connexion");
        }}
      />
    </Screen>
  );
}
