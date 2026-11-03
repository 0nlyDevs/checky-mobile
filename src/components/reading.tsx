import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, RefreshControl, View } from "react-native";

import { AgeLine } from "@/components/age-line";
import { useSyncNow } from "@/components/offline-sync";
import { Field, Screen, T, styles } from "@/components/ui";
import { ArrowLeft } from "@/lib/icons";
import { t } from "@/lib/i18n/fr";
import { useSyncState } from "@/lib/offline";
import { useTheme } from "@/lib/theme";

/** A plain screen to read a set kept on the phone: title, its age, a local search, the rows.
 * Pulling down refreshes every set when there is a network. */
export function ReadingScreen({
  title,
  lead,
  at,
  desk,
  query,
  onQuery,
  children,
}: {
  title: string;
  lead: string;
  at: number | null | undefined;
  desk: boolean;
  query?: string;
  onQuery?: (q: string) => void;
  children: ReactNode;
}) {
  const c = useTheme();
  const router = useRouter();
  const sync = useSyncState();
  const syncNow = useSyncNow(desk);
  return (
    <Screen refreshControl={<RefreshControl refreshing={sync.running} onRefresh={() => syncNow(true)} />}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="title" style={{ flex: 1 }}>
          {title}
        </T>
      </View>
      <T tone="muted">{lead}</T>
      <AgeLine at={at} />
      {onQuery && <Field placeholder={t.offline.search} value={query} onChangeText={onQuery} autoCorrect={false} returnKeyType="search" />}
      {children}
    </Screen>
  );
}

/** Accent-free, case-free words, so « energie » finds « Énergie » on the phone. */
export function fold(s: string | null | undefined): string {
  const raw = s ?? "";
  return (typeof raw.normalize === "function" ? raw.normalize("NFD") : raw)
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold(fields.join(" "));
  return words.every((w) => hay.includes(w));
}
