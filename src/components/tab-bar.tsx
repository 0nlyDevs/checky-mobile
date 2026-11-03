import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, useTheme } from "@/lib/theme";

export const TAB_BAR_HEIGHT = 66;
/** The tab bar occupies layout space; only a breathing gap remains under the last row. */
export function useTabInset(): number {
  return useSafeAreaInsets().bottom + 24;
}

/** The ink bar: every tab is a 44 px+ target, the current one is a paper pill whose label and icon stay ink in both themes. */
export function InkTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", gap: 4, backgroundColor: c.nav, height: TAB_BAR_HEIGHT + bottom, paddingBottom: bottom, paddingHorizontal: 8, alignItems: "center" }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const selected = state.index === index;
        const color = selected ? c.navActiveForeground : c.navForeground;
        const title = options.title ?? route.name;
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={title}
            accessibilityState={{ selected }}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 50,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              backgroundColor: selected ? c.navActive : "transparent",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {options.tabBarIcon?.({ focused: selected, color, size: 22 })}
            <Text numberOfLines={1} style={{ fontFamily: selected ? fonts.semibold : fonts.medium, fontSize: 11.5, color }}>
              {title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
