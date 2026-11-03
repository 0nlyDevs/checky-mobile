import { Tabs } from "expo-router/js-tabs";
import { ChatTeardropText, Gear, ListChecks, Newspaper, Scan } from "@/lib/icons";
import { type ColorValue, View } from "react-native";

import { CheckyButton } from "@/components/checky-button";
import { InkTabBar } from "@/components/tab-bar";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/** The desk's ink bar at the bottom of the phone; the paper pill shows where you are. The Checky button floats above it. */
export default function TabsLayout() {
  const t = useT();
  const c = useTheme();
  const icon =
    (Icon: typeof Scan) =>
    // eslint-disable-next-line react/display-name -- a render prop for one tab, not a component
    ({ color }: { color: ColorValue }) => <Icon size={22} color={String(color)} />;
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Tabs
        tabBar={(props) => <InkTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}
      >
        <Tabs.Screen name="index" options={{ title: t.tabs.analyse, tabBarIcon: icon(Scan) }} />
        <Tabs.Screen name="beat" options={{ title: t.rubrique.tab, tabBarIcon: icon(Newspaper) }} />
        <Tabs.Screen name="claims" options={{ title: t.tabs.claims, tabBarIcon: icon(ListChecks) }} />
        <Tabs.Screen name="verify" options={{ title: t.tabs.ask, tabBarIcon: icon(ChatTeardropText) }} />
        <Tabs.Screen name="settings" options={{ title: t.tabs.settings, tabBarIcon: icon(Gear) }} />
      </Tabs>
      <CheckyButton />
    </View>
  );
}
