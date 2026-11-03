import { useState } from "react";
import { View } from "react-native";

import { Button, Card, Field, Notice, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { fonts } from "@/lib/theme";
import type { ClaimData, Item, Verdict } from "@/lib/types";

const MIN_REASON = 10;

/**
 * « Signer et publier » (brief 2.3): the journalist's byline on the verdict, with the public explanation the
 * formats are written from. Same route as the desk (`POST …/sign`); « Signer sans publier » keeps it inside.
 */
export function SignPanel({ ws, item, verdict, onDone, onCancel }: { ws: string; item: Item; verdict: Verdict; onDone: (item: Item) => void; onCancel: () => void }) {
  const t = useT();
  const d = item.data as ClaimData;
  const [reason, setReason] = useState((d.reason || d.analysis?.reason || "").slice(0, 2000));
  const [busy, setBusy] = useState<"publish" | "sign" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const short = reason.trim().length < MIN_REASON;

  async function sign(publish: boolean) {
    setBusy(publish ? "publish" : "sign");
    setError(null);
    try {
      onDone(await api<Item>(`/workspaces/${ws}/items/${item.id}/sign`, { method: "POST", body: JSON.stringify({ verdict, reason: reason.trim(), publish }) }));
    } catch {
      setError(t.sign.failed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <T style={{ fontFamily: fonts.bold, fontSize: 18 }}>{t.sign.title(t.verdict[verdict])}</T>
      {d.verdict_suggested && d.verdict_suggested !== verdict && <T tone="muted">{t.detail.againstAi(t.verdict[d.verdict_suggested])}</T>}
      <T tone="muted">{t.sign.lead}</T>
      <Field
        label={t.sign.reason}
        placeholder={t.sign.reasonPlaceholder}
        value={reason}
        onChangeText={(v) => setReason(v.slice(0, 2000))}
        multiline
        style={{ minHeight: 96, textAlignVertical: "top" }}
      />
      {short && <T tone="muted">{t.sign.tooShort}</T>}
      <View style={{ gap: 8 }}>
        <Button label={t.sign.publish} busy={busy === "publish"} disabled={short || !!busy} onPress={() => sign(true)} />
        <Button label={t.sign.only} variant="outline" busy={busy === "sign"} disabled={short || !!busy} onPress={() => sign(false)} />
        <Button label={t.common.cancel} variant="ghost" disabled={!!busy} onPress={onCancel} />
      </View>
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
