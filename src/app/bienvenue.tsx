import { useState } from "react";
import { Pressable, Switch, View } from "react-native";

import { Brand } from "@/components/brand";
import { Button, Field, Notice, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { t } from "@/lib/i18n/fr";
import { useTheme } from "@/lib/theme";
import type { Workspace } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

/** Signed in but in no newsroom yet: create one (optionally with the demo claims) or join with an invite. */
export default function Welcome() {
  const c = useTheme();
  const { refresh, choose } = useWorkspace();
  const [name, setName] = useState("");
  const [demo, setDemo] = useState(true);
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy("create");
    setError(null);
    try {
      const ws = await api<Workspace>("/workspaces", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      if (demo) await api(`/workspaces/${ws.id}/demo/reset`, { method: "POST" }).catch(() => null);
      choose(ws.id);
      await refresh();
    } catch {
      setError(t.welcome.failed);
      setBusy(null);
    }
  }

  async function join() {
    // Accepts the whole link (…/invitation/<token>) or the token alone.
    const token = invite.trim().split("/").filter(Boolean).pop() ?? "";
    setBusy("join");
    setError(null);
    try {
      const ws = await api<Workspace>(`/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" });
      choose(ws.id);
      await refresh();
    } catch {
      setError(t.welcome.badInvite);
      setBusy(null);
    }
  }

  return (
    <Screen contentContainerStyle={{ padding: 16, paddingTop: 48, gap: 20 }}>
      <Brand />
      <View style={{ gap: 6 }}>
        <T tone="title">{t.welcome.title}</T>
        <T tone="muted">{t.welcome.lead}</T>
      </View>
      <Field label={t.welcome.name} placeholder={t.welcome.namePlaceholder} value={name} onChangeText={setName} />
      <Pressable onPress={() => setDemo((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: demo }} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <T>{t.welcome.demo}</T>
          <T tone="muted">{t.welcome.demoHint}</T>
        </View>
        <Switch value={demo} onValueChange={setDemo} trackColor={{ true: c.primary, false: c.input }} />
      </Pressable>
      <Button label={t.welcome.create} busy={busy === "create"} disabled={!name.trim() || !!busy} onPress={create} />
      <T tone="muted" style={{ textAlign: "center" }}>
        {t.welcome.or}
      </T>
      <Field label={t.welcome.invite} placeholder={t.welcome.invitePlaceholder} value={invite} onChangeText={setInvite} autoCapitalize="none" />
      <Button label={t.welcome.join} variant="outline" busy={busy === "join"} disabled={!invite.trim() || !!busy} onPress={join} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button label={t.settings.signOut} variant="ghost" onPress={() => authClient.signOut()} />
    </Screen>
  );
}
