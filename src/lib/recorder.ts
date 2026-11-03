import { AudioQuality, IOSOutputFormat, requestRecordingPermissionsAsync, type RecordingOptions, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

/** Brief 6.3, « audio at 32 kbps »: mono speech, a 30 s note weighs about 120 kB. */
export const SPEECH: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.LOW, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: "audio/webm", bitsPerSecond: 32000 },
};
export const SPEECH_MIME = "audio/mp4";

export type Take = { uri: string; seconds: number; startedAt: Date };
export type RecState = "idle" | "recording" | "recorded";

/** One take of up to `max` seconds: record, stop (or stop by itself at the limit), listen, redo. */
export function useTake(max: number) {
  const recorder = useAudioRecorder(SPEECH);
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [denied, setDenied] = useState(false);
  const began = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const running = useRef(false);

  const clear = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const stop = useCallback(async () => {
    if (!running.current) return;
    running.current = false;
    clear();
    const seconds = Math.min(max, Math.max(1, Math.round((Date.now() - began.current) / 1000)));
    try {
      await recorder.stop();
    } catch {
      /* already stopped */
    }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => null);
    if (recorder.uri) setTake({ uri: recorder.uri, seconds, startedAt: new Date(began.current) });
    setState(recorder.uri ? "recorded" : "idle");
  }, [recorder, max]);

  const start = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return setDenied(true);
    setDenied(false);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    running.current = true;
    began.current = Date.now();
    setTake(null);
    setElapsed(0);
    setState("recording");
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - began.current) / 1000);
      setElapsed(Math.min(s, max));
      if (s >= max) void stop();
    }, 250);
  }, [recorder, max, stop]);

  const reset = useCallback(() => {
    setTake(null);
    setElapsed(0);
    setState("idle");
  }, []);

  // Leaving the screen ends the take: the microphone is never left open.
  useEffect(
    () => () => {
      clear();
      if (running.current) {
        running.current = false;
        recorder.stop().catch(() => null);
      }
    },
    [recorder],
  );

  return { state, elapsed, take, denied, start, stop, reset };
}
