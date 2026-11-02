import { Tabs } from "expo-router";
import { ChatTeardropText, Gear, ListChecks, Scan } from "@/lib/icons";
import { type ColorValue, View } from "react-native";

import { t } from "@/lib/i18n/fr";
import { fonts, useTheme } from "@/lib/theme";

/** The desk's ink rail, at the bottom of the phone; the manila marker shows where you are. */
export default function TabsLayout() {
  const c = useTheme();
  const icon =
    (Icon: typeof Scan) =>
    // eslint-disable-next-line react/display-name -- a render prop for one tab, not a component
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <View style={{ alignItems: "center", gap: 4 }}>
        <View style={{ width: 28, height: 3, borderRadius: 2, backgroundColor: focused ? c.manila : "transparent" }} />
        <Icon size={22} color={String(color)} />
      </View>
    );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: c.rail, borderTopColor: c.rail, height: 68, paddingTop: 0 },
        tabBarActiveTintColor: c.manila,
        tabBarInactiveTintColor: c.railMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.analyse, tabBarIcon: icon(Scan) }} />
      <Tabs.Screen name="affirmations" options={{ title: t.tabs.claims, tabBarIcon: icon(ListChecks) }} />
      <Tabs.Screen name="verifier" options={{ title: t.tabs.ask, tabBarIcon: icon(ChatTeardropText) }} />
      <Tabs.Screen name="reglages" options={{ title: t.tabs.settings, tabBarIcon: icon(Gear) }} />
    </Tabs>
  );
}
