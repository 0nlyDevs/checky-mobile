import * as Speech from "expo-speech";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useFocusEffect } from "expo-router";
import { File, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button, Notice, T } from "@/components/ui";
import { speechExcerpt } from "@/lib/assistant-voice";
import { API_URL } from "@/lib/config";
import { useLang, useT } from "@/lib/i18n";
import { Play, Stop } from "@/lib/icons";

/** Read only on request. Native voices first; the server can supply Malagasy when absent locally. */
export function AnswerVoice({ text }: { text: string }) {
  const t = useT();
  const lang = useLang();
  const player = useAudioPlayer(null);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState(false);
  const [clipped, setClipped] = useState(false);
  const request = useRef<AbortController | null>(null);
  const file = useRef<File | null>(null);
  const current = useRef(0);
  useFocusEffect(useCallback(() => () => { current.current++; request.current?.abort(); void Speech.stop().catch(() => null); try { player.pause(); } catch { /* player may already be released */ } setState("idle"); try { file.current?.delete(); } catch { /* cache may already be gone */ } }, [player]));
  useEffect(() => { const subscription = player.addListener("playbackStatusUpdate", status => { if (status.didJustFinish) setState("idle"); }); return () => subscription.remove(); }, [player]);
  async function stop() {
    current.current++; request.current?.abort();
    await Speech.stop(); player.pause(); setState("idle");
  }
  async function play() {
    if (state !== "idle") return stop();
    const seq = ++current.current;
    setError(false); setState("loading");
    try {
      await Speech.stop().catch(() => null);
      const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
      if (current.current !== seq) return;
      const voice = voices.find(v => v.language.toLowerCase().split(/[-_]/)[0] === lang);
      if (voice) {
        const speech = speechExcerpt(text, Math.min(4000, Speech.maxSpeechInputLength));
        setClipped(speech.clipped);
        setState("playing");
        Speech.speak(speech.text, { language: voice.language, voice: voice.identifier, rate: 0.95, onDone: () => { if (current.current === seq) setState("idle"); }, onStopped: () => { if (current.current === seq) setState("idle"); }, onError: () => { if (current.current === seq) { setError(true); setState("idle"); } } });
        return;
      }
      if (lang === "en") throw new Error("No installed English voice");
      const speech = speechExcerpt(text, 900);
      setClipped(speech.clipped);
      const ctrl = new AbortController(); request.current = ctrl;
      const timeout = setTimeout(() => ctrl.abort(), 30000);
      try {
        const response = await expoFetch(`${API_URL}/api/v1/public/speak`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: speech.text, lang }), signal: ctrl.signal });
        if (!response.ok) throw new Error("Voice unavailable");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (current.current !== seq) return;
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        try { file.current?.delete(); } catch { /* expired cache */ }
        const audio = new File(Paths.cache, `checky-assistant-${Date.now()}.mp3`); audio.create(); audio.write(bytes); file.current = audio;
        player.replace(audio.uri); player.play(); setState("playing");
      } finally { clearTimeout(timeout); }
    } catch { if (current.current === seq) { setError(true); setState("idle"); } }
  }
  return <View style={{ gap: 8 }}><Button label={state === "loading" ? t.navigation.preparingAudio : state === "playing" ? t.navigation.stopAudio : t.navigation.listen} icon={state === "idle" ? Play : Stop} variant="outline" onPress={() => void play()} />{clipped && <T tone="muted" style={{ fontSize: 12 }}>{t.navigation.audioExcerpt}</T>}{error && <Notice tone="error">{t.navigation.voiceFailed}</Notice>}</View>;
}
