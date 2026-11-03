import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { CaretRight, ClipboardText, ImageSquare, QrCode, ShareNetwork } from "@/lib/icons";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import useSWR from "swr";

import { PublicVerdictRow } from "@/components/public-verdict-row";
import { Brand } from "@/components/brand";
import { CheckyButton } from "@/components/checky-button";
import { LanguagePicker } from "@/components/language-picker";
import { LightSuggest, LightSwitch } from "@/components/light";
import { OfflineLinks } from "@/components/offline-links";
import { OfflineNotice } from "@/components/outbox";
import { Button, Card, Field, Notice, Screen, Section, T } from "@/components/ui";
import { cachedAt } from "@/lib/cache";
import { ago } from "@/lib/format";
import { handOff } from "@/lib/handoff";
import { useT } from "@/lib/i18n";
import { useMode } from "@/lib/mode";
import { deviceCountry, type MyTip, myTips, publicFetcher } from "@/lib/public";
import { fonts, useTheme } from "@/lib/theme";

const country = deviceCountry();

type Page = { items: import("@/lib/public").PublicVerdict[]; total: number };

/** The citizen's home: paste or share something, see the latest published verdicts and one's own tips. */
export default function CitizenHome() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const { setMode } = useMode();
  const [text, setText] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [tips, setTips] = useState<MyTip[]>([]);
  const latestKey = `/verdicts?limit=5${country ? `&country=${country}` : ""}`;
  const { data: latest } = useSWR<Page>(latestKey, publicFetcher);

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

  /** A photo from the gallery gets the public image check (hints and a detector's score, no verdict). */
  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setPhotoError(t.image.permission);
    setPhotoError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsEditing: false, exif: true });
    const a = res.assets?.[0];
    if (res.canceled || !a) return;
    const mime = a.mimeType ?? "image/jpeg";
    const name = a.fileName ?? `photo.${mime.split("/")[1] ?? "jpg"}`;
    router.push({
      pathname: "/citoyen/verifier",
      params: { id: handOff({ text: text.trim() || undefined, file: { uri: a.uri, mime, name, size: a.fileSize } }) },
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen bottomInset={96}>
        <Brand />
        <View style={{ gap: 6 }}>
          <T tone="title">{t.citizen.title}</T>
          <T tone="muted">{t.citizen.lead}</T>
        </View>
        <LightSuggest />
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.muted, borderColor: c.muted }}>
          <ShareNetwork size={20} color={c.foreground} />
          <T style={{ flex: 1, fontSize: 15 }}>{t.citizen.shareHint}</T>
        </Card>
        <Field placeholder={t.citizen.placeholder} value={text} onChangeText={setText} multiline style={{ minHeight: 96, textAlignVertical: "top" }} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label={t.citizen.paste}
            icon={ClipboardText}
            variant="outline"
            style={{ flex: 1 }}
            onPress={async () => setText((await Clipboard.getStringAsync()).trim())}
          />
          <Button label={t.citizen.check} style={{ flex: 1 }} disabled={!text.trim()} onPress={check} />
        </View>
        <Button label={t.image.pick} icon={ImageSquare} variant="outline" onPress={pickPhoto} />
        {photoError && <Notice tone="error">{photoError}</Notice>}
        <Button label={t.scanner.title} icon={QrCode} variant="outline" onPress={() => router.push("/scanner")} />

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
          <OfflineNotice stale={!!latest} at={cachedAt(latestKey)} />
          {latest?.items.length ? latest.items.map((v) => <PublicVerdictRow key={v.id} v={v} />) : <T tone="muted">{t.citizen.noLatest}</T>}
        </Section>

        <LanguagePicker />
        <Section title={t.offline.title}>
          <OfflineLinks desk={false} />
          <LightSwitch />
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
      <CheckyButton tabs={false} />
    </View>
  );
}
