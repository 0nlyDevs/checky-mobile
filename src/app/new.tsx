import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button, Chip, Field, Notice, Screen, T, styles } from "@/components/ui";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { isNetworkError, isOnline } from "@/lib/network";
import { useOutbox } from "@/lib/outbox";
import type { Origin } from "@/lib/types";
import { useWs } from "@/lib/workspace";
import { goBack } from "@/lib/nav";

const ORIGINS: Origin[] = ["whatsapp", "facebook", "tiktok", "radio", "press", "other"];

export default function NewClaim() {
  const t = useT();
  const ws = useWs();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [origin, setOrigin] = useState<Origin>("whatsapp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [queued, setQueued] = useState(false);
  const outbox = useOutbox();

  /** No network: kept in "À envoyer" and created when it comes back. */
  function later() {
    outbox.add({ kind: "claim", claim: { title: title.trim(), origin } });
    setQueued(true);
    setBusy(false);
  }

  async function create() {
    setBusy(true);
    setError(false);
    if (!(await isOnline())) return later();
    try {
      // Same route as the copilot: the API assigns the next FAN ref.
      const made = await api<{ item_id: string }>(`/workspaces/${ws}/copilot/act`, {
        method: "POST",
        body: JSON.stringify({ kind: "create_claim", title: title.trim(), origin }),
      });
      router.replace({ pathname: "/claim/[id]", params: { id: made.item_id } });
    } catch (e) {
      if (isNetworkError(e) || !(await isOnline())) return later();
      setError(true);
      setBusy(false);
    }
  }

  if (queued) {
    return (
      <Screen>
        <T tone="title">{t.newClaim.title}</T>
        <Notice>{t.outbox.queuedClaim}</Notice>
        <Button label={t.outbox.back} onPress={goBack} />
      </Screen>
    );
  }

  return (
    <Screen>
      <T tone="title">{t.newClaim.title}</T>
      <Field label={t.newClaim.claim} placeholder={t.newClaim.claimPlaceholder} value={title} onChangeText={setTitle} multiline style={{ minHeight: 96, textAlignVertical: "top" }} autoFocus />
      <View style={{ gap: 8 }}>
        <T tone="label">{t.newClaim.origin}</T>
        <View style={styles.wrap}>
          {ORIGINS.map((o) => (
            <Chip key={o} label={t.origin[o]} selected={origin === o} onPress={() => setOrigin(o)} />
          ))}
        </View>
      </View>
      {error && <Notice tone="error">{t.newClaim.failed}</Notice>}
      <Button label={t.newClaim.create} busy={busy} disabled={!title.trim()} onPress={create} />
      <Button label={t.common.cancel} variant="ghost" onPress={goBack} />
    </Screen>
  );
}
