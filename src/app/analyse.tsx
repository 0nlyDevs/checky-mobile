import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { ArrowLeft, ArrowSquareOut, CheckSquare, SealCheck, Sparkle, Square } from "@/lib/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { OnDemand } from "@/components/light";
import { OfflineNotice } from "@/components/outbox";
import { Button, Card, Field, Notice, Screen, Section, Step, type StepState, T, VerdictPanel, styles } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { host } from "@/lib/format";
import { type Check, openWeb, pickUp } from "@/lib/handoff";
import { tr, useT } from "@/lib/i18n";
import { isNetworkError, isOnline } from "@/lib/network";
import { useOutbox } from "@/lib/outbox";
import { postStream } from "@/lib/sse";
import { fonts, radius, useTheme } from "@/lib/theme";
import type { CheckResult, Origin } from "@/lib/types";
import { uploadFile, waitReady } from "@/lib/upload";
import { useWs } from "@/lib/workspace";

type Steps = Record<string, { state: StepState; detail?: string }>;

const ORIGIN: Record<string, Origin> = { facebook: "facebook", whatsapp: "whatsapp", tiktok: "tiktok" };

/** One shared video, photo, link or text, checked end to end: what it says, warning signs, what
 * fact-checkers already say, a suggested verdict. Nothing reaches the desk until "Suivre". */
export default function Analyse() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const ws = useWs();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const outbox = useOutbox();
  // Only checks handed over in memory by the share sheet, the Analyser tab or the outbox; a bare deep link gets nothing.
  const handed = pickUp(id);
  // Sent from "À envoyer" once the network came back: the result is already there.
  const entry = handed?.queued ? outbox.entries.find((e) => e.id === handed.queued) : undefined;
  const job = useMemo<Check | null>(() => (entry ? (entry.check ?? {}) : handed?.queued ? null : handed), [entry, handed]);
  const p = { url: job?.url, text: job?.text, file: job?.file?.uri, mime: job?.file?.mime, name: job?.file?.name, size: job?.file?.size };
  const isFile = !!p.file;
  const order = [...(isFile ? ["upload", "ingest"] : []), "read", "claims", "search", "verdict"];

  const [steps, setSteps] = useState<Steps>({});
  const [result, setResult] = useState<CheckResult | null>(entry?.result ?? null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [extra, setExtra] = useState("");
  const [claim, setClaim] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [tracking, setTracking] = useState(false);
  const [queued, setQueued] = useState(false);
  const [offline, setOffline] = useState(false);
  const sourceId = useRef<string | null>(entry?.sourceId ?? null);
  const abort = useRef<AbortController | null>(null);
  const started = useRef(false);

  const step = (key: string, state: StepState, detail?: string) => setSteps((s) => ({ ...s, [key]: { state, detail } }));

  const run = useCallback(
    async (pasted?: string) => {
      // Read at call time: a language switch must not restart (and abort) a running check.
      const t = tr();
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setRunning(true);
      setError(null);
      setResult(null);
      setSteps((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k === "upload" || k === "ingest")));
      try {
        if (isFile && !sourceId.current) {
          step("upload", "running", t.check.percent(0));
          const src = await uploadFile(ws, { uri: p.file!, mime: p.mime ?? "application/octet-stream", name: p.name ?? "fichier", size: p.size ?? null }, (share) =>
            step("upload", "running", t.check.percent(share)),
          );
          step("upload", "done");
          step("ingest", "running");
          const ready = await waitReady(ws, src.id, ctrl.signal);
          const meta = (ready.file?.meta ?? {}) as { duration_s?: number; language?: string };
          step("ingest", "done", [meta.duration_s ? t.check.duration(meta.duration_s) : "", meta.language ? t.check.language(meta.language) : ""].filter(Boolean).join(" · "));
          sourceId.current = src.id;
        }
        const body = sourceId.current
          ? { source_id: sourceId.current, ...(pasted ? { text: pasted } : {}) }
          : { url: p.url || undefined, text: [p.text, pasted].filter(Boolean).join("\n\n") || undefined };
        await postStream(
          `/workspaces/${ws}/link-check`,
          body,
          (event, data) => {
            if (event === "step") {
              const d = data as { key: string; status: string; summary: string };
              const summary = d.key === "verdict" ? (t.verdict[d.summary] ?? d.summary) : d.summary;
              step(d.key, d.status === "running" ? "running" : d.status === "failed" ? "failed" : "done", summary || undefined);
            } else if (event === "result") {
              setResult(data as CheckResult);
              setClaim(0);
              setPicked(new Set());
            } else if (event === "error") {
              const code = (data as { code?: string }).code;
              setError(code === "ai_unavailable" ? t.check.busy : t.check.failed);
            }
          },
          ctrl.signal,
        );
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const code = e instanceof ApiError ? e.code : "";
        setSteps((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.state === "running" ? { state: "failed" as const } : v])));
        setOffline(isNetworkError(e) || !(await isOnline()));
        setError(
          e instanceof ApiError && e.status === 429
            ? t.check.tooMany
            : code === "too_large"
              ? t.check.tooLarge
              : code === "unsupported_type"
                ? t.check.unsupported
                : code === "source_failed"
                  ? t.check.sourceFailed(e instanceof Error ? e.message : "")
                  : t.check.failed,
        );
      } finally {
        if (abort.current === ctrl) setRunning(false);
      }
    },
    [isFile, p.file, p.mime, p.name, p.size, p.text, p.url, ws],
  );

  /** Into "À envoyer": kept on the phone, sent and analysed when the network is back. An upload
   * that already went through is not sent again. */
  const later = useCallback(() => {
    const t = tr();
    if (!job) return;
    try {
      outbox.add({ kind: "check", check: { url: job.url, text: job.text, file: job.file }, sourceId: sourceId.current ?? undefined });
      setQueued(true);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError && e.code === "too_large" ? t.check.tooLarge : t.check.failed);
    }
  }, [job, outbox]);

  useEffect(() => {
    if (started.current || !job || entry) return;
    started.current = true;
    void isOnline().then((on) => (on ? run() : later()));
    return () => abort.current?.abort();
  }, [run, later, job, entry]);

  async function track() {
    if (!result) return;
    const title = (result.claims?.[claim] ?? result.title ?? result.summary ?? p.url ?? result.excerpt ?? "").slice(0, 300) || t.check.title;
    setTracking(true);
    try {
      const act = (body: Record<string, unknown>) => api<{ item_id: string; ref: string | null }>(`/workspaces/${ws}/copilot/act`, { method: "POST", body: JSON.stringify(body) });
      const made = await act({
        kind: "create_claim",
        title,
        body: [result.summary, result.url ?? ""].filter(Boolean).join("\n\n"),
        origin: (result.platform && ORIGIN[result.platform]) || (result.kind === "page" ? "press" : "other"),
      });
      if (sourceId.current) {
        await api(`/workspaces/${ws}/sources/${sourceId.current}`, { method: "PATCH", body: JSON.stringify({ item_id: made.item_id }) }).catch(() => null);
      }
      const links = [result.url, ...picked].filter((u, i, all): u is string => !!u && all.indexOf(u) === i);
      for (const link of links) await act({ kind: "attach_link", item_id: made.item_id, url: link }).catch(() => null);
      router.replace({ pathname: "/affirmation/[id]", params: { id: made.item_id } });
      if (entry) outbox.remove(entry.id);
    } catch {
      setError(t.check.trackFailed);
      setTracking(false);
    }
  }

  const a = result?.analysis;
  const fileMeta = result?.file?.meta ?? result?.image;
  const isImage = (p.mime ?? "").startsWith("image/") || result?.kind === "image";
  const needsText = !!result?.needs_text;
  const toggle = (u: string) =>
    setPicked((all) => {
      const next = new Set(all);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });

  return (
    <Screen>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="title" style={{ flex: 1 }}>
          {t.check.title}
        </T>
        {job?.shared && <T tone="muted">{t.check.shared}</T>}
      </View>

      <OfflineNotice />
      {!job && <Notice>{t.analyse.empty}</Notice>}
      {isFile && <Preview uri={p.file!} mime={p.mime ?? ""} />}
      {!isFile && !!p.url && (
        <T tone="muted" numberOfLines={1} ellipsizeMode="middle">
          {p.url}
        </T>
      )}

      {queued ? (
        <>
          <Notice>{t.outbox.queued}</Notice>
          <Button label={t.outbox.back} onPress={() => router.replace("/")} />
        </>
      ) : (
        (!entry || Object.keys(steps).length > 0) && (
          <Card>
            {order.map((k) => (
              <Step key={k} label={t.check.steps[k]} state={steps[k]?.state ?? "waiting"} detail={steps[k]?.detail} />
            ))}
            {running && <Button label={t.check.stop} variant="ghost" onPress={() => abort.current?.abort()} />}
          </Card>
        )
      )}

      {error && <Notice tone="error">{error}</Notice>}
      {error && !running && <Button label={t.common.retry} variant="outline" onPress={() => run(extra || undefined)} />}
      {error && !running && offline && !queued && <Button label={t.outbox.later} onPress={later} />}

      {result && (
        <>
          {result.tracked && (
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <T style={{ flex: 1 }}>{t.check.tracked(result.tracked.ref ?? result.tracked.title)}</T>
              <Button label={t.common.open} variant="outline" onPress={() => router.push({ pathname: "/affirmation/[id]", params: { id: result.tracked!.item_id } })} />
            </Card>
          )}

          {(needsText || (isFile && !result.excerpt && !isImage)) && (
            <View style={{ gap: 10 }}>
              <Notice>{needsText && result.read_error !== "no_speech" ? t.check.needsText : t.check.noSpeech}</Notice>
              <Field placeholder={t.analyse.textPlaceholder} value={extra} onChangeText={setExtra} multiline style={{ minHeight: 96, textAlignVertical: "top" }} />
              <Button label={t.check.rerun} disabled={!extra.trim() || running} onPress={() => run(extra.trim())} />
            </View>
          )}

          {!!result.excerpt && (
            <Section title={isFile && !isImage ? t.check.transcript : t.check.content}>
              <Card>
                {!!result.title && !isFile && <T style={{ fontFamily: fonts.semibold }}>{result.title}</T>}
                {!!(result.site || result.author) && <T tone="muted">{[result.site, result.author].filter(Boolean).join(" · ")}</T>}
                <T numberOfLines={8}>{result.excerpt}</T>
                {!!result.final_url && <LinkRow label={t.check.openOriginal} url={result.final_url} />}
              </Card>
            </Section>
          )}

          {a ? (
            <Section title={t.check.suggestion}>
              <VerdictPanel verdict={a.verdict} suggested>
                {!!a.reason && <T>{a.reason}</T>}
                {a.evidence.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <T tone="label">{t.check.evidence}</T>
                    {a.evidence.map((e, i) => {
                      const r = result.results?.find((x) => x.n === e.result);
                      return (
                        <View key={i} style={{ gap: 2 }}>
                          <T style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
                            {t.check.stance[e.stance] ?? e.stance} · {r ? host(r.url) : t.check.result(e.result)}
                          </T>
                          <T style={{ fontFamily: fonts.quote, fontSize: 17, lineHeight: 24 }}>« {e.quote} »</T>
                        </View>
                      );
                    })}
                  </View>
                )}
                {!!a.missing && (
                  <T tone="muted">
                    {t.check.missing} : {a.missing}
                  </T>
                )}
                <T tone="muted">{t.check.humanConfirms}</T>
              </VerdictPanel>
            </Section>
          ) : (
            !!result.claims?.length && <Notice>{t.check.noVerdict}</Notice>
          )}

          {!!result.claims?.length && (
            <Section title={t.check.claims}>
              {result.claims.map((x, i) => (
                <Pressable key={i} accessibilityRole="radio" accessibilityState={{ checked: claim === i }} onPress={() => setClaim(i)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 4 }}>
                  <View style={{ width: 20, height: 20, marginTop: 2, borderRadius: 10, borderWidth: 2, borderColor: c.foreground, alignItems: "center", justifyContent: "center" }}>
                    {claim === i && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.foreground }} />}
                  </View>
                  <T style={{ flex: 1 }}>{x}</T>
                </Pressable>
              ))}
            </Section>
          )}

          {result.signals && (result.claims?.length ?? 0) > 0 && (
            <Section title={t.check.signals} note={t.check.signalsNote}>
              {result.signals.length === 0 ? (
                <T tone="muted">{t.check.noSignals}</T>
              ) : (
                result.signals.map((s, i) => (
                  <Card key={i} style={{ gap: 4 }}>
                    <T style={{ fontFamily: fonts.semibold }}>{t.check.signal[s.type] ?? s.type}</T>
                    <T style={{ fontFamily: fonts.quote, fontSize: 17, lineHeight: 24 }}>« {s.quote} »</T>
                    {!!s.why && <T tone="muted">{s.why}</T>}
                  </Card>
                ))
              )}
            </Section>
          )}

          {(isFile || result.kind === "image") && fileMeta && (
            <Section title={t.check.file}>
              <Card style={{ gap: 8 }}>
                {fileMeta.ai_markers?.length ? (
                  <View style={[styles.row, { alignItems: "flex-start", padding: 12, borderRadius: radius.card, backgroundColor: c.image[1] }]}>
                    <Sparkle size={16} color={c.image.strong} style={{ marginTop: 3 }} />
                    <T style={{ flex: 1, color: c.foreground, fontFamily: fonts.semibold }}>{t.check.markers(fileMeta.ai_markers.join(", "))}</T>
                  </View>
                ) : (
                  <T tone="muted">{t.check.noMarkers}</T>
                )}
                {fileMeta.content_credentials && (
                  <View style={styles.row}>
                    <SealCheck size={16} color={c.image.strong} />
                    <T style={{ flex: 1 }}>{t.check.credentials}</T>
                  </View>
                )}
                {!!result.reverse_search?.length && (
                  <View style={{ gap: 4 }}>
                    <T tone="label">{t.check.reverse}</T>
                    {result.reverse_search.map((r) => (
                      <LinkRow key={r.name} label={r.name} url={r.url} />
                    ))}
                  </View>
                )}
              </Card>
            </Section>
          )}

          {result.results && (result.claims?.length ?? 0) > 0 && (
            <Section title={t.check.elsewhere} note={result.results.length ? t.check.elsewhereNote : undefined}>
              {result.results.length === 0 ? (
                <T tone="muted">{t.check.noResults}</T>
              ) : (
                result.results.map((r) => {
                  const on = picked.has(r.url);
                  const Box = on ? CheckSquare : Square;
                  return (
                    <Card key={r.url} style={{ gap: 6 }}>
                      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(r.url)} style={{ flexDirection: "row", gap: 10 }}>
                        <Box size={22} color={c.foreground} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <T tone="label">
                            [{r.n}] {t.check.kind[r.kind] ?? r.kind} · {host(r.url)}
                          </T>
                          <T style={{ fontFamily: fonts.semibold }}>{r.title}</T>
                          <T tone="muted" numberOfLines={3}>
                            {r.snippet}
                          </T>
                        </View>
                      </Pressable>
                      <LinkRow label={t.common.open} url={r.url} />
                    </Card>
                  );
                })
              )}
            </Section>
          )}

          {!result.tracked && (result.claims?.length || isFile || result.excerpt) ? <Button label={tracking ? t.check.tracking : t.check.track} busy={tracking} onPress={track} /> : null}
          <Button label={t.check.again} variant="outline" onPress={() => router.replace("/")} />
        </>
      )}
    </Screen>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={() => openWeb(url)} style={[styles.row, { paddingVertical: 6 }]}>
      <ArrowSquareOut size={15} color={c.foreground} />
      <T style={{ textDecorationLine: "underline", fontSize: 15 }}>{label}</T>
    </Pressable>
  );
}

function Preview({ uri, mime }: { uri: string; mime: string }) {
  if (mime.startsWith("image/")) {
    return (
      <OnDemand kind="image">
        <Image source={{ uri }} contentFit="contain" style={{ width: "100%", height: 220, borderRadius: radius.card }} accessibilityIgnoresInvertColors />
      </OnDemand>
    );
  }
  if (mime.startsWith("video/")) {
    return (
      <OnDemand kind="video">
        <VideoPreview uri={uri} />
      </OnDemand>
    );
  }
  return null;
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (pl) => {
    pl.muted = true;
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: "100%", height: 220, borderRadius: radius.card, backgroundColor: "#000" }} />;
}
