import { type ReactNode, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { T } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { CaretRight } from "@/lib/icons";
import { fonts, useTheme } from "@/lib/theme";

/** Comparable cards share a row. A list alternative makes every item reachable without swiping. */
export function ContentRail<Item>({ title, items, itemKey, renderItem, onSeeAll }: { title: string; items: Item[]; itemKey: (item: Item) => string; renderItem: (item: Item) => ReactNode; onSeeAll?: () => void }) {
  const t = useT();
  const c = useTheme();
  const { width } = useWindowDimensions();
  const [list, setList] = useState(false);
  const cardWidth = Math.min(320, width - 64);
  if (!items.length) return null;
  return <View style={{ gap: 14, marginTop: 10, marginBottom: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><T accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.bold, fontSize: 23, lineHeight: 28 }}>{title} <T tone="muted">{items.length}</T></T>{onSeeAll && <Pressable accessibilityRole="button" accessibilityLabel={`${t.navigation.all} · ${title}`} onPress={onSeeAll} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2 }}><T style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{t.navigation.all}</T><CaretRight size={16} color={c.foreground} /></Pressable>}</View>
    {list ? <View style={{ gap: 14 }}>{items.map(item => <View key={itemKey(item)}>{renderItem(item)}</View>)}</View> : <FlatList horizontal data={items} keyExtractor={itemKey} renderItem={({ item }) => <View style={{ width: cardWidth }}>{renderItem(item)}</View>} ItemSeparatorComponent={() => <View style={{ width: 14 }} />} showsHorizontalScrollIndicator contentContainerStyle={{ paddingBottom: 10 }} snapToInterval={cardWidth + 14} decelerationRate="fast" keyboardShouldPersistTaps="handled" accessibilityLabel={`${title}. ${t.navigation.swipe}`} />}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}><T tone="muted" style={{ flex: 1, fontSize: 12 }}>{list ? t.navigation.count(items.length) : t.navigation.swipe}</T><Pressable accessibilityRole="button" accessibilityLabel={`${list ? t.navigation.cards : t.navigation.list} · ${title}`} onPress={() => setList(!list)} style={{ minHeight: 44, justifyContent: "center" }}><T style={{ fontSize: 12, fontFamily: fonts.semibold, textDecorationLine: "underline" }}>{list ? t.navigation.cards : t.navigation.list}</T></Pressable></View>
  </View>;
}
