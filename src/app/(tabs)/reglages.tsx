import Constants from "expo-constants";
import { Alert, View } from "react-native";
import useSWR from "swr";

import { useTabInset } from "@/components/tab-bar";
import { Button, Card, Chip, Notice, Screen, Section, T, styles } from "@/components/ui";
import { api, clearApiToken } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { clearCache } from "@/lib/cache";
import { API_URL } from "@/lib/config";
import { t } from "@/lib/i18n/fr";
import { fonts } from "@/lib/theme";
import type { Health } from "@/lib/types";
import { useOutbox } from "@/lib/outbox";
import { useWorkspace } from "@/lib/workspace";

type Check = { status: string; latency_ms?: number | null };

export default function Settings() {
  const inset = useTabInset();
  const { me, current, choose, refresh } = useWorkspace();
  const outbox = useOutbox();
  const unsent = outbox.entries.filter((e) => e.state !== "done").length;

  /** Signing out wipes what this phone kept offline: cached claims and files, and unsent items. */
  async function signOut() {
    clearApiToken();
    await authClient.signOut();
    outbox.clear();
    clearCache();
    await refresh();
  }

  function confirmSignOut() {
    if (!unsent) return void signOut();
    Alert.alert(t.settings.signOut, t.settings.signOutPending(unsent), [
      { text: t.common.cancel, style: "cancel" },
      { text: t.settings.signOut, style: "destructive", onPress: () => void signOut() },
    ]);
  }
  const { data: health, error } = useSWR<Health>("health", () => fetch(`${API_URL}/api/v1/health`).then((r) => r.json()));

  function resetDemo() {
    if (!current) return;
    Alert.alert(t.settings.demo, t.settings.demoConfirm, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.detail.confirm,
        onPress: async () => {
          await api(`/workspaces/${current.workspace_id}/demo/reset`, { method: "POST" }).catch(() => null);
          Alert.alert(t.settings.demoDone);
        },
      },
    ]);
  }

  const rows: [string, Check][] = health
    ? [...Object.entries((health.checks ?? {}) as Record<string, Check>), ...Object.entries((health.ai ?? {}) as Record<string, Check>)]
    : [];
  const word = (s: string) => (s === "up" ? t.settings.up : s === "down" ? t.settings.down : t.settings.notConfigured);

  return (
    <Screen bottomInset={inset}>
      <T tone="title">{t.settings.title}</T>
      <Section title={t.settings.account}>
        <Card>
          <T style={{ fontFamily: fonts.semibold }}>{me?.name}</T>
          <T tone="muted">{me?.email}</T>
        </Card>
      </Section>
      <Section title={t.settings.newsroom}>
        <View style={styles.wrap}>
          {(me?.memberships ?? []).map((m) => (
            <Chip key={m.workspace_id} label={m.name} selected={m.workspace_id === current?.workspace_id} onPress={() => choose(m.workspace_id)} />
          ))}
        </View>
        {current && <T tone="muted">{t.settings.role[current.role] ?? current.role}</T>}
        {current?.role === "admin" && <Button label={t.settings.demo} variant="outline" onPress={resetDemo} />}
      </Section>
      <Section title={t.settings.health}>
        {error ? (
          <Notice tone="error">{t.common.offline}</Notice>
        ) : (
          <Card style={{ gap: 6 }}>
            {rows.map(([name, check]) => (
              <View key={name} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <T style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
                  {name}
                </T>
                <T tone="muted" style={{ flexShrink: 0 }}>
                  {word(check.status)}
                  {check.latency_ms ? ` · ${check.latency_ms} ms` : ""}
                </T>
              </View>
            ))}
            <T tone="muted">
              {t.settings.server} : {API_URL}
            </T>
          </Card>
        )}
      </Section>
      <Button
        label={t.settings.signOut}
        variant="outline"
        onPress={confirmSignOut}
      />
      <T tone="muted" style={{ textAlign: "center" }}>
        Checky {Constants.expoConfig?.version}
      </T>
    </Screen>
  );
}
