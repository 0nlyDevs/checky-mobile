import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable } from "react-native";
import { Card, Screen, T } from "@/components/ui";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { myTips, type MyTip } from "@/lib/public";
import { fonts } from "@/lib/theme";

/** The follow-up links are a destination, not an undiscoverable block under the home feed. */
export default function MyReports() {
  const t = useT();
  const router = useRouter();
  const [tips, setTips] = useState<MyTip[]>([]);
  useFocusEffect(useCallback(() => { myTips().then(setTips); }, []));
  return <Screen><T tone="title">{t.citizen.mine}</T><T tone="muted">{t.tip.lead}</T>{tips.map(tip => <Pressable key={tip.token} accessibilityRole="button" onPress={() => router.push({ pathname: "/citizen/track/[token]", params: { token: tip.token } })}><Card><T tone="tabular">{tip.ref}</T><T style={{ fontFamily: fonts.bold, fontSize: 19 }}>{tip.title}</T><T tone="muted">{tip.newsroom} · {ago(tip.at)}</T></Card></Pressable>)}{!tips.length && <T tone="muted">{t.navigation.noCases}</T>}</Screen>;
}
