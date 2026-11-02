import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ClipboardText, Images, ShareNetwork } from "@/lib/icons";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";

import { OfflineNotice, OutboxList } from "@/components/outbox";
import { useTabInset } from "@/components/tab-bar";
import { Button, Card, Field, Notice, Screen, T } from "@/components/ui";
import { handOff } from "@/lib/handoff";
import { t } from "@/lib/i18n/fr";
import { useTheme } from "@/lib/theme";

/** Home: what to check. Most checks arrive by the share sheet; this screen is for the rest. */
export default function AnalyseHome() {
  const c = useTheme();
  const router = useRouter();
  const inset = useTabInset();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const urlField = useRef<ComponentRef<typeof TextInput>>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The Checky button navigates here with a fresh `focus` value each press.
  useEffect(() => {
    if (!focus) return;
    const id = setTimeout(() => urlField.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [focus]);

  function go() {
    const u = url.trim();
    const x = text.trim();
    if (!u && !x) return setError(t.analyse.empty);
    setError(null);
    router.push({ pathname: "/analyse", params: { id: handOff({ url: u || undefined, text: x || undefined }) } });
  }

  async function paste() {
    const s = (await Clipboard.getStringAsync()).trim();
    if (/^https?:\/\//i.test(s)) setUrl(s);
    else if (s) setText(s);
  }

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(t.analyse.permission);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos", "images"], quality: 1, allowsEditing: false, exif: true });
    const a = res.assets?.[0];
    if (res.canceled || !a) return;
    const mime = a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg");
    const name = a.fileName ?? `${a.type === "video" ? "video" : "photo"}.${mime.split("/")[1] ?? "bin"}`;
    router.push({ pathname: "/analyse", params: { id: handOff({ file: { uri: a.uri, mime, name, size: a.fileSize } }) } });
  }

  return (
    <Screen bottomInset={inset}>
      <View style={{ gap: 6 }}>
        <T tone="title">{t.analyse.title}</T>
        <T tone="muted">{t.analyse.lead}</T>
      </View>
      <OfflineNotice />
      <OutboxList />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.muted, borderColor: c.muted }}>
        <ShareNetwork size={20} color={c.foreground} />
        <T style={{ flex: 1, fontSize: 15 }}>{t.analyse.shareHint}</T>
      </Card>
      <Button label={t.analyse.pick} icon={Images} onPress={pick} />
      <View style={{ gap: 12 }}>
        <Field
          ref={urlField}
          label={t.analyse.url}
          placeholder={t.analyse.urlPlaceholder}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          inputMode="url"
          onSubmitEditing={go}
        />
        <Field label={t.analyse.text} placeholder={t.analyse.textPlaceholder} value={text} onChangeText={setText} multiline style={{ minHeight: 96, textAlignVertical: "top" }} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label={t.analyse.paste} icon={ClipboardText} variant="outline" onPress={paste} style={{ flex: 1 }} />
          <Button label={t.analyse.submit} onPress={go} style={{ flex: 1 }} />
        </View>
        {error && <Notice tone="error">{error}</Notice>}
      </View>
    </Screen>
  );
}
