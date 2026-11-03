import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button, Notice, T } from "@/components/ui";
import { API_URL } from "@/lib/config";
import { errorFrom } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { Microphone, Stop } from "@/lib/icons";
import { SPEECH_MIME, useTake } from "@/lib/recorder";

/** Dictation only fills the editable composer. It never sends a question or executes an action. */
export function VoiceComposer({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const t = useT();
  const lang = useLang();
  const rec = useTake(60);
  const [transcribing, setTranscribing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const consumed = useRef<string | null>(null);
  const takeLanguage = useRef(lang);
  const focused = useRef(true);
  const request = useRef<AbortController | null>(null);
  const recording = rec.state === "recording";
  const stop = rec.stop;
  async function toggleRecording() {
    if (recording) return rec.stop();
    if (starting || transcribing || disabled) return;
    setStarting(true); setError(false);
    try { takeLanguage.current = lang; await rec.start(); } catch { setError(true); } finally { setStarting(false); }
  }
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; request.current?.abort(); void stop(); }; }, [stop]));
  useEffect(() => {
    const take = rec.take;
    if (!take || !focused.current || consumed.current === take.uri) return;
    consumed.current = take.uri;
    const language = takeLanguage.current;
    const ctrl = new AbortController();
    request.current = ctrl;
    let active = true;
    const timeout = setTimeout(() => ctrl.abort(), 60_000);
    setTranscribing(true); setError(false);
    (async () => {
      const bytes = new Uint8Array(await new File(take.uri).arrayBuffer());
      const response = await expoFetch(`${API_URL}/api/v1/public/transcribe${language === "en" ? "" : `?lang=${language}`}`, { method: "POST", headers: { "content-type": SPEECH_MIME }, body: bytes, signal: ctrl.signal });
      if (!response.ok) throw await errorFrom(response as unknown as Response);
      const out = await response.json() as { text: string };
      if (active && focused.current && !ctrl.signal.aborted) { if (out.text?.trim()) onText(out.text.trim()); else setError(true); }
    })().catch(() => { if (active && focused.current) setError(true); }).finally(() => { clearTimeout(timeout); if (active) setTranscribing(false); });
    return () => { active = false; clearTimeout(timeout); ctrl.abort(); };
  }, [rec.take, onText]);
  return <View style={{ gap: 8 }}>
    <Button label={recording ? `${t.navigation.recording} · ${rec.elapsed}s` : transcribing ? t.navigation.transcribing : t.navigation.dictate} icon={recording ? Stop : Microphone} variant={recording ? "primary" : "outline"} busy={transcribing || starting} disabled={disabled || transcribing || starting} onPress={() => void toggleRecording()} />
    <T tone="muted" style={{ fontSize: 12 }}>{t.navigation.voiceHint}</T>
    {rec.denied && <Notice tone="error">{t.voice.micDenied}</Notice>}
    {error && <Notice tone="error">{t.navigation.voiceFailed}</Notice>}
  </View>;
}
