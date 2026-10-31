import * as Sharing from "expo-sharing";
import { type ComponentRef, type RefObject } from "react";
import { Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

import { VERDICT_ICON } from "@/components/ui";
import { t } from "@/lib/i18n/fr";
import { fonts } from "@/lib/theme";
import type { Verdict } from "@/lib/types";

export type CardLang = "fr" | "mg";

// The card is a shared artefact: the desk's fixed palette (DESIGN.md), the same in light and dark mode.
const C = { rail: "#0f3b36", ground: "#f4f6f5", ink: "#14201d", muted: "#4b5a56", rule: "#c9d3d0" };
const FILL: Record<Verdict, { fill: string; on: string }> = {
  true: { fill: "#267a42", on: "#ffffff" },
  misleading: { fill: "#c98a12", on: "#14201d" },
  false: { fill: "#c43d32", on: "#ffffff" },
  unverifiable: { fill: "#66716c", on: "#ffffff" },
};
const SIZE = 540;

export type CardRef = RefObject<ComponentRef<typeof View> | null>;

type Props = { verdict: Verdict; title: string; reason?: string | null; sources: string[]; refLabel?: string | null; desk: string; lang: CardLang };

/** Same card as the desk's (apps/web/components/claims/verdict-card.tsx): 540 × 540, exported at 1080 × 1080.
 * Drawn at full size and shown scaled to `width`; `cardRef` is the view to capture. */
export function VerdictCardView({ width, cardRef, ...p }: Props & { width: number; cardRef: CardRef }) {
  const scale = width / SIZE;
  return (
    <View style={{ width, height: width, overflow: "hidden", borderRadius: 5, borderWidth: 1, borderColor: C.rule }}>
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
  return (
    <View style={{ flex: 1, backgroundColor: C.ground }}>
      <View style={{ backgroundColor: C.rail, paddingVertical: 18, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Svg width={24} height={24} viewBox="0 0 64 64">
          <Rect width={64} height={64} rx={10} fill="#dcc9a3" />
          <Path d="M12 22h14l4-6h22v34a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z" fill="#141210" />
          <Rect x={19} y={31} width={26} height={9} rx={1.5} fill="none" stroke="#c42a20" strokeWidth={3} transform="rotate(-9 32 35.5)" />
        </Svg>
        <Text style={{ fontFamily: fonts.tabular, fontSize: 21, color: "#ffffff", letterSpacing: 0.6 }}>{t.app.name}</Text>
        <Text style={{ marginLeft: "auto", fontFamily: fonts.body, fontSize: 14, color: "#e6ece9" }}>{words.checked}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 28, paddingVertical: 24, justifyContent: "center", gap: 18 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: FILL[verdict].fill, borderRadius: 5, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon size={32} color={FILL[verdict].on} />
          <Text style={{ fontFamily: fonts.tabular, fontSize: 36, lineHeight: 40, color: FILL[verdict].on, textTransform: "uppercase", letterSpacing: 0.6 }}>{words.verdicts[verdict]}</Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: C.muted }}>{words.claim}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 24, lineHeight: 31, color: C.ink }} numberOfLines={4}>
            « {title} »
          </Text>
        </View>
        {!!reason && (
          <Text style={{ fontFamily: fonts.body, fontSize: 18, lineHeight: 27, color: C.ink }} numberOfLines={5}>
            {reason}
          </Text>
        )}
        {names.length > 0 && (
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: C.muted }} numberOfLines={1}>
            {words.sources} : {names.join(" · ")}
          </Text>
        )}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: C.rule, marginHorizontal: 28, paddingTop: 14, paddingBottom: 18, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {!!refLabel && <Text style={{ fontFamily: fonts.tabular, fontSize: 16, color: C.ink }}>{refLabel}</Text>}
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: C.muted, flexShrink: 1 }} numberOfLines={1}>
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
