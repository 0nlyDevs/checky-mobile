import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "@/lib/icons";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useSWR from "swr";

import { ClaimRow } from "@/components/claim-row";
import { OfflineNotice, OutboxList } from "@/components/outbox";
import { Button, Chip, Field, Notice, T } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { t } from "@/lib/i18n/fr";
import { useTheme } from "@/lib/theme";
import { type ItemPage, STATUSES } from "@/lib/types";
import { useWs } from "@/lib/workspace";

export default function Claims() {
  const c = useTheme();
  const ws = useWs();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const params = new URLSearchParams({ type: "claim", limit: "200", ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
  const { data, error, isLoading, mutate } = useSWR<ItemPage>(`/workspaces/${ws}/items?${params}`, fetcher, { keepPreviousData: true });

  useFocusEffect(
    useCallback(() => {
      void mutate();
    }, [mutate]),
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ClaimRow item={item} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={isLoading && !!data} onRefresh={() => void mutate()} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T tone="title">{t.claims.title}</T>
              <Button label={t.claims.new} icon={Plus} variant="outline" onPress={() => router.push("/nouvelle")} />
            </View>
            <Field placeholder={t.claims.search} value={q} onChangeText={setQ} returnKeyType="search" autoCorrect={false} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label={t.claims.filters.all} selected={!status} onPress={() => setStatus(null)} />
              {STATUSES.map((s) => (
                <Chip key={s} label={t.claims.filters[s]} selected={status === s} onPress={() => setStatus(s)} />
              ))}
            </ScrollView>
            <OfflineNotice stale={!!data} />
            {error && !data && <Notice tone="error">{t.common.offline}</Notice>}
            <OutboxList kind="claim" />
          </View>
        }
        ListEmptyComponent={!isLoading && !error ? <T tone="muted">{t.claims.empty}</T> : undefined}
      />
    </SafeAreaView>
  );
}
