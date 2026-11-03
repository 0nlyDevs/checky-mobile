import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, T } from "@/components/ui";
import { fingerprint, rememberOffer, worthOffering } from "@/lib/clip";
import { host } from "@/lib/format";
import { handOff } from "@/lib/handoff";
import { useT } from "@/lib/i18n";
import { ClipboardText } from "@/lib/icons";
import { fonts, radius, useTheme } from "@/lib/theme";

const KEY = "fanilo.clip";

/** « Vérifier ce que vous venez de copier ? » when Checky opens or comes back to the front with
 * a link or a sentence in the clipboard that was not offered before. Android only: it reads the
 * clipboard once per return (Android 13+ then shows its « collé » toast, which is the point:
 * the journalist sees Checky read it), and only when the clipboard holds text, which is checked
 * first without reading it. Only a fingerprint is kept, never the text. iOS would ask to paste
 * each time, so it relies on the « Coller » button. */
export function ClipboardOffer({ to }: { to: "/analyse" | "/citoyen/verifier" }) {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [clip, setClip] = useState<{ value: string; kind: "link" | "text" } | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // A short wait: Android hands the clipboard only to the app that has the focus.
    const probe = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          if (!(await Clipboard.hasStringAsync())) return;
          const value = (await Clipboard.getStringAsync()).trim();
          const kind = worthOffering(value);
          if (!kind) return;
          const print = fingerprint(value);
          const next = rememberOffer(await SecureStore.getItemAsync(KEY), print);
          if (!next) return;
          await SecureStore.setItemAsync(KEY, next);
          if (live) setClip({ value, kind });
        } catch {
          // no access: nothing offered
        }
      }, 500);
    };
    probe();
    const sub = AppState.addEventListener("change", (s) => s === "active" && probe());
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);

  if (!clip) return null;
  const check = () => {
    setClip(null);
    router.push({ pathname: to, params: { id: handOff(clip.kind === "link" ? { url: clip.value } : { text: clip.value }) } });
  };
  return (
    <View
      accessibilityRole="alert"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        top: insets.top + 8,
        padding: 14,
        gap: 10,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <ClipboardText size={20} color={c.foreground} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontFamily: fonts.semibold }}>{t.clip.ask}</T>
          <T tone="muted" numberOfLines={2}>
            {clip.kind === "link" ? `${t.clip.link} · ${host(clip.value) || clip.value}` : `${t.clip.text} · « ${clip.value} »`}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={t.clip.dismiss} variant="ghost" onPress={() => setClip(null)} style={{ flex: 1 }} />
        <Button label={t.clip.check} onPress={check} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
