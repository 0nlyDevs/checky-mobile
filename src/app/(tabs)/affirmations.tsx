import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "@/lib/icons";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useSWR from "swr";

import { ClaimRow } from "@/components/claim-row";
import { ContentRail } from "@/components/content-rail";
import { useAppChrome } from "@/components/app-header";
import { OfflineNotice, OutboxList } from "@/components/outbox";
import { useTabInset } from "@/components/tab-bar";
import { Button, Chip, Field, Notice, T } from "@/components/ui";
import { fetcher } from "@/lib/api";
import { cachedAt } from "@/lib/cache";
import { useT } from "@/lib/i18n";
import { useLight } from "@/lib/light";
import { useTheme } from "@/lib/theme";
import { type ItemPage, STATUSES } from "@/lib/types";
import { useWs } from "@/lib/workspace";

export default function Claims() {
  const t = useT();
  const c = useTheme();
  const inset = useTabInset();
  const ws = useWs();
  const router = useRouter();
  const chrome = useAppChrome();
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const params = new URLSearchParams({ type: "claim", limit: "200", ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
  const key = `/workspaces/${ws}/items?${params}`;
  const { data, error, isLoading, mutate } = useSWR<ItemPage>(key, fetcher, { keepPreviousData: true });

  const { light } = useLight();
  // Mode léger: a list fetched in the last 5 minutes is not fetched again on every visit.
  useFocusEffect(
    useCallback(() => {
      if (light && Date.now() - (cachedAt(key) ?? 0) < 5 * 60_000) return;
      void mutate();
    }, [mutate, light, key]),
  );

  return (
    <SafeAreaView edges={chrome ? [] : ["top"]} style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ gap: 12, padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><T tone="title" style={{ flex: 1 }}>{t.claims.title}</T><Button label={t.claims.new} icon={Plus} variant="outline" onPress={() => router.push("/nouvelle")} /></View>
        <Field accessibilityLabel={t.claims.search} placeholder={t.claims.search} value={q} onChangeText={setQ} returnKeyType="search" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 8, paddingBottom: 4 }}><Chip label={t.claims.filters.all} selected={!status} onPress={() => setStatus(null)} />{STATUSES.map(s => <Chip key={s} label={t.claims.filters[s]} selected={status === s} onPress={() => setStatus(s)} />)}</ScrollView>
      </View>
      <FlatList
        data={status || q.trim() ? data?.items ?? [] : []}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ClaimRow item={item} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: inset }}
        refreshControl={<RefreshControl refreshing={isLoading && !!data} onRefresh={() => void mutate()} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <OfflineNotice stale={!!data} at={cachedAt(key)} />
            {error && !data && <Notice tone="error">{t.common.offline}</Notice>}
            <OutboxList kind="claim" />
            {!status && !q.trim() && STATUSES.map(s => <ContentRail key={s} title={t.claims.filters[s]} items={(data?.items ?? []).filter(item => item.status === s)} itemKey={item => item.id} renderItem={item => <ClaimRow item={item} compact />} onSeeAll={() => setStatus(s)} />)}
          </View>
        }
        ListEmptyComponent={isLoading && !data ? <T tone="muted">{t.common.loading}</T> : !error && !data?.items.length ? <T tone="muted">{t.claims.empty}</T> : undefined}
      />
    </SafeAreaView>
  );
}
