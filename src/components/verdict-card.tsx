import * as Sharing from "expo-sharing";
import { type ComponentRef, type RefObject, useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

import { VERDICT_ICON } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { qrPath, shortLink } from "@/lib/qr";
import { fonts } from "@/lib/theme";
import { light } from "@/lib/tokens";
import type { Verdict } from "@/lib/types";

export type CardLang = "fr" | "mg";
/** The square card for WhatsApp groups and Facebook, and the 9:16 story (brief « To send back »). */
export type CardFormat = "square" | "story";
/** The verdict's seal as the API gives it (`GET …/items/{id}/seal`): the QR's URL carries the signature. */
export type Seal = { url: string; number?: number | null };

// The card is a shared artefact: Checky's fixed light tokens, the same in light and dark mode.
const C = light;
/** Drawn at these sizes, exported at 2× (1080 × 1080, 1080 × 1920), as on the desk. */
export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = { square: { w: 540, h: 540 }, story: { w: 540, h: 960 } };

export type CardRef = RefObject<ComponentRef<typeof View> | null>;

type Props = {
  verdict: Verdict;
  title: string;
  reason?: string | null;
  sources: string[];
  refLabel?: string | null;
  desk: string;
  lang: CardLang;
  format?: CardFormat;
  seal?: Seal | null;
  verified?: boolean;
};

/** Same card as the desk's (apps/web/components/claims/verdict-card.tsx). Drawn at full size and shown
 * scaled to `width`; `cardRef` is the view to capture. */
export function VerdictCardView({ width, cardRef, ...p }: Props & { width: number; cardRef: CardRef }) {
  const size = CARD_SIZE[p.format ?? "square"];
  const scale = width / size.w;
  return (
    <View style={{ width, height: size.h * scale, overflow: "hidden", borderRadius: 20, borderWidth: 1, borderColor: C.border }}>
      <View style={{ width: size.w, height: size.h, transform: [{ scale }], transformOrigin: "top left" }}>
        <View ref={cardRef} collapsable={false} style={{ width: size.w, height: size.h }}>
          <Card {...p} />
        </View>
      </View>
    </View>
  );
}

/** The newsroom's signature as a QR: any phone camera opens the public page, which checks the card. */
function SealQr({ seal, size, caption }: { seal: Seal; size: number; caption: string }) {
  const { box, d } = useMemo(() => qrPath(seal.url), [seal.url]);
  return (
    <View style={{ width: size, alignItems: "center", gap: 4, flexShrink: 0 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`} accessibilityLabel={caption}>
        <Rect x={0} y={0} width={box} height={box} fill="#ffffff" />
        <Path d={d} fill={C.foreground} />
      </Svg>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 13, color: C.foreground, textAlign: "center" }}>{caption}</Text>
    </View>
  );
}

function Card({ verdict, title, reason, sources, refLabel, desk, lang, format = "square", seal, verified }: Props) {
  const t = useT();
  const words = t.card.words[lang];
  const Icon = VERDICT_ICON[verdict];
  const names = sources.filter((v, i, a) => !!v && a.indexOf(v) === i).slice(0, 3);
  const tone = C.verdict[verdict];
  const story = format === "story";
  const muted = { fontFamily: fonts.regular, fontSize: story ? 17 : 14, color: C.mutedForeground };
  const pad = story ? 36 : 28;
  // « vérification 145 »: the same number on every format, the radio and the SMS.
  const number = seal?.number != null ? words.number(seal.number) : refLabel;
  const short = shortLink(seal);
  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* The story's top and bottom bands sit under WhatsApp's and Facebook's own bars: nothing there. */}
      {story && <View style={{ height: 64 }} />}
      <View style={{ paddingTop: story ? 20 : 28, paddingHorizontal: pad, flexDirection: "row", alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.display, fontSize: story ? 26 : 22, color: C.foreground, letterSpacing: -0.6 }}>
          {t.app.name}
          <Text style={{ fontFamily: fonts.quote }}>.</Text>
        </Text>
        <Text style={{ ...muted, marginLeft: "auto" }}>{words.checked}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: pad, paddingVertical: story ? 28 : 14, justifyContent: "center", gap: story ? 26 : 14 }}>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: tone.soft,
            borderRadius: 999,
            paddingVertical: story ? 14 : 10,
            paddingLeft: story ? 20 : 16,
            paddingRight: story ? 28 : 22,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Icon size={story ? 44 : 32} color={tone.ink} />
          <Text style={{ fontFamily: fonts.bold, fontSize: story ? 50 : 34, lineHeight: story ? 58 : 40, color: tone.ink, textTransform: "uppercase", letterSpacing: -0.5 }}>{words.verdicts[verdict]}</Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={muted}>{words.claim}</Text>
          <Text
            style={{ fontFamily: fonts.bold, fontSize: story ? 34 : 24, lineHeight: story ? 42 : 30, color: C.foreground, letterSpacing: -0.5 }}
            numberOfLines={story ? 5 : seal ? 3 : 4}
          >
            « {title} »
          </Text>
        </View>
        {!!reason && (
          <Text style={{ fontFamily: fonts.quote, fontSize: story ? 27 : 20, lineHeight: story ? 36 : 26, color: C.foreground }} numberOfLines={story ? 6 : seal ? 3 : 5}>
            {reason}
          </Text>
        )}
        {names.length > 0 && (
          <Text style={muted} numberOfLines={story ? 2 : 1}>
            {words.sources} : {names.join(" · ")}
          </Text>
        )}
      </View>
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: C.rule,
          marginHorizontal: pad,
          paddingTop: story ? 18 : 10,
          paddingBottom: story ? 22 : 14,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 16,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          {!!number && <Text style={{ fontFamily: fonts.semibold, fontSize: story ? 22 : 18, color: C.foreground, fontVariant: ["tabular-nums"] }}>{number}</Text>}
          {!!short && <Text style={{ fontFamily: fonts.bold, fontSize: story ? 17 : 14, color: C.foreground }}>{short}</Text>}
          <Text style={muted} numberOfLines={1}>
            {words.by(desk)}
          </Text>
          {verified && <Text style={{ fontFamily: fonts.bold, fontSize: story ? 17 : 14, color: C.foreground }}>✓ {words.verified}</Text>}
        </View>
        {seal && <SealQr seal={seal} size={story ? 176 : 124} caption={words.scan} />}
      </View>
      {story && <View style={{ height: 64 }} />}
    </View>
  );
}

/** Capture the card at 1080 wide (1080 × 1080 or 1080 × 1920) and open the system share sheet (WhatsApp, Facebook…). */
export async function shareCard(cardRef: CardRef, title: string, format: CardFormat = "square"): Promise<boolean> {
  if (!cardRef.current) return false;
  const { w, h } = CARD_SIZE[format];
  const uri = await captureRef(cardRef, { format: "png", width: w * 2, height: h * 2, result: "tmpfile" });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: title, UTI: "public.png" });
  return true;
}
