import { useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import useSWR from "swr";
import { Button, Card, Chip, Field, Notice, Screen, T } from "@/components/ui";
import { api, fetcher } from "@/lib/api";
import type { components } from "@/lib/api-schema";
import { stamp } from "@/lib/format";
import { openWeb } from "@/lib/handoff";
import { useT } from "@/lib/i18n";
import { ArrowSquareOut, Check, Phone, X } from "@/lib/icons";
import { fonts } from "@/lib/theme";
import { useWorkspace } from "@/lib/workspace";

type Request = components["schemas"]["AdminRequestOut"];
const STATUSES = ["pending", "approved", "refused"] as const;

/** The same admin-only API and identity checks as the web; never a client-side role grant. */
export default function Administration() {
  const t = useT();
  const { me, refresh } = useWorkspace();
  const [status, setStatus] = useState<typeof STATUSES[number]>("pending");
  const rows = useSWR<Request[]>(me?.platform_admin ? `/platform/requests?status=${status}` : null, fetcher, { shouldRetryOnError: false });
  if (!me?.platform_admin) return <Screen><Notice tone="error">{t.navigation.denied}</Notice></Screen>;
  return <Screen>
    <T tone="title">{t.navigation.admin}</T><T tone="muted">{t.navigation.adminLead}</T>
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>{STATUSES.map(s => <Chip key={s} label={t.navigation[s]} selected={status === s} onPress={() => setStatus(s)} />)}</ScrollView>
    {rows.isLoading && <T tone="muted">{t.common.loading}</T>}
    {rows.error && <><Notice tone="error">{t.common.offline}</Notice><Button label={t.common.retry} variant="outline" onPress={() => void rows.mutate()} /></>}
    {rows.data?.length === 0 && <T tone="muted">{t.navigation.emptyRequests}</T>}
    {rows.data?.map(row => <RequestCard key={`${row.workspace_id}-${row.status}`} row={row} onDone={() => { void rows.mutate(); void refresh(); }} />)}
  </Screen>;
}

function RequestCard({ row, onDone }: { row: Request; onDone: () => void }) {
  const t = useT();
  const q = row.request;
  const [busy, setBusy] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function act(kind: "approve" | "refuse") {
    if (busy || (kind === "refuse" && reason.trim().length < 3)) return;
    setBusy(true); setMessage(null);
    try {
      await api(`/platform/requests/${row.workspace_id}/${kind}`, { method: "POST", ...(kind === "refuse" ? { body: JSON.stringify({ reason: reason.trim() }) } : {}) });
      onDone();
      Alert.alert(t.navigation.saved);
    } catch { setMessage(t.navigation.actionFailed); }
    finally { setBusy(false); }
  }
  return <Card style={{ gap: 16, padding: 22 }}>
    <T style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 }}>{q.outlet}</T>
    <T tone="muted">{[q.kind, q.city, q.region, q.country_name].filter(Boolean).join(" · ")}</T>
    <T>{q.full_name} · {q.job_title}</T><T selectable>{q.email}</T><T selectable tone="tabular">{q.phone}</T><T tone="muted">{stamp(row.submitted_at)}</T>
    {q.press_card && <T selectable tone="muted">{q.press_card}</T>}
    {row.reason && <Notice>{row.reason}</Notice>}
    <Button label={t.navigation.officialPage} icon={ArrowSquareOut} variant="outline" onPress={() => openWeb(q.website)} />
    {/^[+]\d{7,15}$/.test(q.phone) && <Button label={t.navigation.call} icon={Phone} variant="outline" onPress={() => void Linking.openURL(`tel:${q.phone}`).catch(() => setMessage(t.navigation.actionFailed))} />}
    {message && <Notice tone="error">{message}</Notice>}
    {row.status !== "approved" && <Button label={t.navigation.approve} icon={Check} busy={busy} disabled={busy} onPress={() => Alert.alert(t.navigation.approveQuestion, t.navigation.approveHint, [{ text: t.common.cancel, style: "cancel" }, { text: t.navigation.confirm, onPress: () => void act("approve") }])} />}
    {row.status === "pending" && !refusing && <Button label={t.navigation.refuse} icon={X} variant="outline" disabled={busy} onPress={() => setRefusing(true)} />}
    {refusing && <View style={{ gap: 12 }}><Field label={t.navigation.reason} value={reason} onChangeText={setReason} maxLength={1000} multiline editable={!busy} /><Button label={t.navigation.confirm} variant="outline" busy={busy} disabled={reason.trim().length < 3 || busy} onPress={() => void act("refuse")} /><Button label={t.common.cancel} variant="ghost" disabled={busy} onPress={() => setRefusing(false)} /></View>}
  </Card>;
}
