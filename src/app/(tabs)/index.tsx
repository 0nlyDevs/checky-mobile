import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ClipboardPaste, Images, Share2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Button, Card, Field, Notice, Screen, T } from "@/components/ui";
import { t } from "@/lib/i18n/fr";
import { useTheme } from "@/lib/theme";

/** Home: what to check. Most checks arrive by the share sheet; this screen is for the rest. */
export default function AnalyseHome() {
  const c = useTheme();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function go() {
    const u = url.trim();
    const x = text.trim();
    if (!u && !x) return setError(t.analyse.empty);
    setError(null);
    router.push({ pathname: "/analyse", params: { ...(u ? { url: u } : {}), ...(x ? { text: x } : {}) } });
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
    router.push({ pathname: "/analyse", params: { file: a.uri, mime, name, ...(a.fileSize ? { size: String(a.fileSize) } : {}) } });
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <T tone="title">{t.analyse.title}</T>
        <T tone="muted">{t.analyse.lead}</T>
      </View>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.muted, borderColor: c.muted }}>
        <Share2 size={20} color={c.foreground} />
        <T style={{ flex: 1, fontSize: 15 }}>{t.analyse.shareHint}</T>
      </Card>
      <Button label={t.analyse.pick} icon={Images} onPress={pick} />
      <View style={{ gap: 12 }}>
        <Field
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
          <Button label={t.analyse.paste} icon={ClipboardPaste} variant="outline" onPress={paste} style={{ flex: 1 }} />
          <Button label={t.analyse.submit} onPress={go} style={{ flex: 1 }} />
        </View>
        {error && <Notice tone="error">{error}</Notice>}
      </View>
    </Screen>
  );
}
