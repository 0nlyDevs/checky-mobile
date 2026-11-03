import { cacheDirectory, downloadAsync } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { View } from "react-native";
import useSWR from "swr";

import { TakePlayer } from "@/components/take-player";
import { Button, Card, Notice, T } from "@/components/ui";
import { api, ApiError, fetcher } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Microphone, ShareNetwork, Stop, Trash } from "@/lib/icons";
import { SPEECH_MIME, useTake } from "@/lib/recorder";
import { fonts } from "@/lib/theme";
import { uploadUnread } from "@/lib/upload";

export const VOICE_MAX = 30;
export type VoiceNoteOut = { file_id: string; url: string; mime: string; size_bytes: number; seconds: number | null; language: string };

/**
 * « Enregistrer la voix » (brief « To send back »): the démenti in the journalist's own voice, 30 seconds at most.
 * Listen, keep or redo; kept, it goes to storage and is attached to the signed dossier. It is never a source and
 * never transcribed (spoken Malagasy stays with people). Sharing it sends the file to WhatsApp and counts as sent.
 */
export function VoiceNote({ ws, itemId, refLabel, onSent }: { ws: string; itemId: string; refLabel: string; onSent: () => void }) {
  const t = useT();
  const key = `/workspaces/${ws}/items/${itemId}/voice-note`;
  const { data: note, error, mutate } = useSWR<VoiceNoteOut>(key, fetcher, { shouldRetryOnError: false });
  const rec = useTake(VOICE_MAX);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "default" | "error"; text: string } | null>(null);
  const missing = error instanceof ApiError && error.status === 404;

  async function keep() {
    if (!rec.take) return;
    setSaving(0);
    setMessage(null);
    try {
      const fileId = await uploadUnread(ws, { uri: rec.take.uri, mime: SPEECH_MIME, name: `dementi-${refLabel}-mg.m4a` }, setSaving);
      await mutate(api<VoiceNoteOut>(key, { method: "PUT", body: JSON.stringify({ file_id: fileId, seconds: rec.take.seconds, language: "mg" }) }), { revalidate: false });
      rec.reset();
      setMessage({ tone: "default", text: t.voice.saved });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof ApiError && e.code === "not_signed" ? t.voice.notSigned : t.voice.failed });
    } finally {
      setSaving(null);
    }
  }

  async function share() {
    if (!note) return;
    try {
      const file = await downloadAsync(note.url, `${cacheDirectory}dementi-${refLabel}-mg.m4a`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: note.mime, dialogTitle: t.voice.shareTitle(refLabel) });
        onSent();
      }
    } catch {
      setMessage({ tone: "error", text: t.voice.failed });
    }
  }

  async function remove() {
    try {
      await api(key, { method: "DELETE" });
      await mutate(undefined, { revalidate: false });
    } catch {
      setMessage({ tone: "error", text: t.voice.failed });
    }
  }

  const idle = rec.state === "idle";
  return (
    <Card>
      <T style={{ fontFamily: fonts.bold, fontSize: 18 }}>{t.voice.title}</T>
      <T tone="muted">{t.voice.lead}</T>

      {rec.state === "recording" && (
        <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
          <T tone="tabular" style={{ fontSize: 28, lineHeight: 34 }}>
            {t.voice.elapsed(rec.elapsed, VOICE_MAX)}
          </T>
          <Button label={t.voice.stop} icon={Stop} onPress={rec.stop} />
        </View>
      )}

      {rec.state === "recorded" && rec.take && (
        <View style={{ gap: 8 }}>
          <T tone="muted">{t.voice.takeLength(rec.take.seconds)}</T>
          <TakePlayer uri={rec.take.uri} play={t.voice.listen} stop={t.voice.pause} />
          <Button label={saving === null ? t.voice.keep : t.voice.saving} busy={saving !== null} onPress={keep} />
          <Button label={t.voice.redo} variant="ghost" disabled={saving !== null} onPress={rec.start} />
        </View>
      )}

      {idle && note && (
        <View style={{ gap: 8 }}>
          <T tone="tabular">{t.voice.kept(note.seconds ? Math.round(note.seconds) : null)}</T>
          <Button label={t.voice.share} icon={ShareNetwork} onPress={share} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label={t.voice.again} icon={Microphone} variant="outline" onPress={rec.start} style={{ flex: 1 }} />
            <Button label={t.voice.remove} icon={Trash} variant="outline" onPress={remove} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {idle && !note && (missing || !!error) && <Button label={t.voice.record} icon={Microphone} variant="outline" onPress={rec.start} />}
      {rec.denied && <Notice tone="error">{t.voice.micDenied}</Notice>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </Card>
  );
}
