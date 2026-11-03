import { type ReactNode, useState } from "react";
import { Pressable, Switch, View } from "react-native";

import { Button, Card, T } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { ImageSquare, Lightning, VideoCamera } from "@/lib/icons";
import { useLight } from "@/lib/light";
import { useSyncState } from "@/lib/offline";
import { fonts, radius, useTheme } from "@/lib/theme";

/** The Réglages switch, with what it changes. */
export function LightSwitch() {
  const t = useT();
  const c = useTheme();
  const { light, setLight } = useLight();
  return (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Lightning size={20} color={c.foreground} />
        <T style={{ flex: 1, fontFamily: fonts.semibold }}>{t.light.title}</T>
        <Switch
          accessibilityLabel={t.light.title}
          value={light}
          onValueChange={setLight}
          trackColor={{ true: c.primary, false: c.muted }}
          thumbColor={c.card}
        />
      </View>
      <T tone="muted">{t.light.hint}</T>
    </Card>
  );
}

/** Suggested once per launch when a small request took long (measured by the offline sync). */
export function LightSuggest() {
  const t = useT();
  const { light, setLight, dismissed, dismiss } = useLight();
  const { slow } = useSyncState();
  if (light || dismissed || !slow) return null;
  return (
    <Card style={{ gap: 10 }}>
      <T>{t.light.suggest}</T>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={t.light.enable} icon={Lightning} onPress={() => setLight(true)} style={{ flex: 1 }} />
        <Button label={t.light.later} variant="ghost" onPress={dismiss} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/** Heavy media behind a tap in Mode léger; shown at once otherwise. */
export function OnDemand({ kind, height = 220, children }: { kind: "image" | "video"; height?: number; children: ReactNode }) {
  const t = useT();
  const c = useTheme();
  const { light } = useLight();
  const [shown, setShown] = useState(false);
  if (!light || shown) return <>{children}</>;
  const Icon = kind === "video" ? VideoCamera : ImageSquare;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kind === "video" ? t.light.showVideo : t.light.showImage}
      onPress={() => setShown(true)}
      style={{ height, borderRadius: radius.card, borderWidth: 1, borderColor: c.border, backgroundColor: c.muted, alignItems: "center", justifyContent: "center", gap: 6, padding: 16 }}
    >
      <Icon size={28} color={c.foreground} />
      <T style={{ fontFamily: fonts.semibold }}>{kind === "video" ? t.light.showVideo : t.light.showImage}</T>
      <T tone="muted" style={{ textAlign: "center" }}>
        {t.light.onDemand}
      </T>
    </Pressable>
  );
}
