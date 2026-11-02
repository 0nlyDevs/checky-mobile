import * as Sharing from "expo-sharing";
import { type ComponentRef, type RefObject } from "react";
import { Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { VERDICT_ICON } from "@/components/ui";
import { t } from "@/lib/i18n/fr";
import { fonts } from "@/lib/theme";
import { light } from "@/lib/tokens";
import type { Verdict } from "@/lib/types";

export type CardLang = "fr" | "mg";

// The card is a shared artefact: Checky's fixed light tokens, the same in light and dark mode.
const C = light;
const SIZE = 540;

export type CardRef = RefObject<ComponentRef<typeof View> | null>;

type Props = { verdict: Verdict; title: string; reason?: string | null; sources: string[]; refLabel?: string | null; desk: string; lang: CardLang };

/** Same card as the desk's (apps/web/components/claims/verdict-card.tsx): 540 × 540, exported at 1080 × 1080.
 * Drawn at full size and shown scaled to `width`; `cardRef` is the view to capture. */
export function VerdictCardView({ width, cardRef, ...p }: Props & { width: number; cardRef: CardRef }) {
  const scale = width / SIZE;
  return (
    <View style={{ width, height: width, overflow: "hidden", borderRadius: 20, borderWidth: 1, borderColor: C.border }}>
      <View style={{ width: SIZE, height: SIZE, transform: [{ scale }], transformOrigin: "top left" }}>
        <View ref={cardRef} collapsable={false} style={{ width: SIZE, height: SIZE }}>
          <Card {...p} />
        </View>
      </View>
    </View>
  );
}

function Card({ verdict, title, reason, sources, refLabel, desk, lang }: Props) {
  const words = t.card.words[lang];
  const Icon = VERDICT_ICON[verdict];
  const names = sources.filter((v, i, a) => !!v && a.indexOf(v) === i).slice(0, 3);
  const tone = C.verdict[verdict];
  const muted = { fontFamily: fonts.regular, fontSize: 14, color: C.mutedForeground };
  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <View style={{ paddingTop: 28, paddingHorizontal: 28, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.mutedForeground }}>{words.checked}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 28, paddingVertical: 20, justifyContent: "center", gap: 18 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: tone.soft, borderRadius: 999, paddingVertical: 10, paddingLeft: 16, paddingRight: 22, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon size={32} color={tone.ink} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, color: tone.ink, textTransform: "uppercase", letterSpacing: -0.5 }}>{words.verdicts[verdict]}</Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={muted}>{words.claim}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: C.foreground, letterSpacing: -0.5 }} numberOfLines={4}>
            « {title} »
          </Text>
        </View>
        {!!reason && (
          <Text style={{ fontFamily: fonts.quote, fontSize: 21, lineHeight: 28, color: C.foreground }} numberOfLines={5}>
            {reason}
          </Text>
        )}
        {names.length > 0 && (
          <Text style={muted} numberOfLines={1}>
            {words.sources} : {names.join(" · ")}
          </Text>
        )}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: C.rule, marginHorizontal: 28, paddingTop: 14, paddingBottom: 18, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: C.foreground, letterSpacing: -0.6 }}>
          {t.app.name}
          <Text style={{ fontFamily: fonts.quote }}>.</Text>
        </Text>
        {!!refLabel && <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: C.foreground, flexShrink: 0 }}>{refLabel}</Text>}
        <Text style={{ ...muted, flexShrink: 1, marginLeft: "auto" }} numberOfLines={1}>
          {words.by(desk)}
        </Text>
      </View>
    </View>
  );
}

/** Capture the card at 1080 × 1080 and open the system share sheet (WhatsApp, Facebook…). */
export async function shareCard(cardRef: CardRef, title: string): Promise<boolean> {
  if (!cardRef.current) return false;
  const uri = await captureRef(cardRef, { format: "png", width: 1080, height: 1080, result: "tmpfile" });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: title, UTI: "public.png" });
  return true;
}
