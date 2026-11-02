import { Tabs } from "expo-router/js-tabs";
import { ChatTeardropText, Gear, ListChecks, Scan } from "@/lib/icons";
import { type ColorValue, View } from "react-native";

import { InkTabBar } from "@/components/tab-bar";
import { t } from "@/lib/i18n/fr";
import { useTheme } from "@/lib/theme";

/** The desk's ink bar at the bottom of the phone; the paper pill shows where you are. The Checky button floats above it. */
export default function TabsLayout() {
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
        <Tabs.Screen name="affirmations" options={{ title: t.tabs.claims, tabBarIcon: icon(ListChecks) }} />
        <Tabs.Screen name="verifier" options={{ title: t.tabs.ask, tabBarIcon: icon(ChatTeardropText) }} />
        <Tabs.Screen name="reglages" options={{ title: t.tabs.settings, tabBarIcon: icon(Gear) }} />
      </Tabs>
    </View>
  );
}
