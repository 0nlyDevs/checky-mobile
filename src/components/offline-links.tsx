import { type Href, useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { T } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { AddressBook, CaretRight, ChartBar, type Icon, SealCheck, Stamp } from "@/lib/icons";
import { fonts, radius, useTheme } from "@/lib/theme";

/** The sets kept on the phone that have no tab of their own: one row each. */
export function OfflineLinks({ desk }: { desk: boolean }) {
  const t = useT();
  const rows: [string, Icon, Href][] = [
    ...(desk
      ? ([
          [t.directory.title, AddressBook, "/directory"],
          [t.figures.title, ChartBar, "/figures"],
        ] as [string, Icon, Href][])
      : []),
    [t.registry.title, Stamp, "/registry"],
    [t.verdictsOffline.title, SealCheck, "/verdicts"],
  ];
  return (
    <View style={{ gap: 8 }}>
      {rows.map(([label, Icon, href]) => (
        <LinkRow key={label} label={label} Icon={Icon} href={href} />
      ))}
    </View>
  );
}

function LinkRow({ label, Icon, href }: { label: string; Icon: Icon; href: Href }) {
  const c = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 52,
        paddingHorizontal: 14,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Icon size={20} color={c.foreground} />
      <T style={{ flex: 1, fontFamily: fonts.semibold }}>{label}</T>
      <CaretRight size={18} color={c.foreground} />
    </Pressable>
  );
}
