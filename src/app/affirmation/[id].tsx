import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, FileText, type Icon, ImageSquare, Link, Paperclip, TextT, VideoCamera, Waveform } from "@/lib/icons";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import useSWR from "swr";

import { SIGN_BAR_ROOM, SignBar } from "@/components/sign-bar";
import { ShareVerdict } from "@/components/share-verdict";
import { Button, Card, Chip, Field, Notice, Screen, Section, StatusLabel, T, VERDICT_ICON, VerdictPanel, styles } from "@/components/ui";
import { api, ApiError, fetcher } from "@/lib/api";
import { ago, span } from "@/lib/format";
import { openWeb } from "@/lib/handoff";
import { t } from "@/lib/i18n/fr";
import { fonts, radius, tracking, useTheme } from "@/lib/theme";
import { type ClaimData, type Comment, type Item, type ItemPatch, type Source, STATUSES, type Status, type Verdict, VERDICTS } from "@/lib/types";
import { uploadFile } from "@/lib/upload";
import { useWorkspace, useWs } from "@/lib/workspace";

const KIND_ICON: Record<string, Icon> = { url: Link, pdf: FileText, image: ImageSquare, audio: Waveform, video: VideoCamera, text: TextT };

/** Same rule as the desk: a verdict moves the claim to Vérifié, removing it moves it back. */
function statusAfter(verdict: Verdict | null, status: Status): Status {
  if (verdict) return status === "to_check" || status === "in_progress" ? "verified" : status;
  return status === "verified" ? "in_progress" : status;
}

export default function ClaimDetail() {
  const c = useTheme();
  const router = useRouter();
  const ws = useWs();
  const { me, current } = useWorkspace();
  const { id } = useLocalSearchParams<{ id: string }>();
  const base = `/workspaces/${ws}/items/${id}`;
  const { data: item, error, mutate } = useSWR<Item>(base, fetcher);
  const { data: sources, mutate: mutateSources } = useSWR<Source[]>(`/workspaces/${ws}/sources?item_id=${id}`, fetcher);
  const { data: comments, mutate: mutateComments } = useSWR<Comment[]>(`${base}/comments`, fetcher);
  const [notice, setNotice] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [link, setLink] = useState("");
  const [upload, setUpload] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  if (error) {
    return (
      <Screen>
        <Notice tone="error">{t.common.offline}</Notice>
        <Button label={t.common.retry} onPress={() => mutate()} />
      </Screen>
    );
  }
  if (!item) {
    return (
      <Screen>
        <T tone="muted">{t.common.loading}</T>
      </Screen>
    );
  }

  const d = item.data as ClaimData;

  async function patch(change: ItemPatch) {
    const previous = item;
    mutate({ ...item!, ...change, data: { ...item!.data, ...(change.data ?? {}) } } as Item, { revalidate: false });
    try {
      mutate(await api<Item>(base, { method: "PATCH", body: JSON.stringify(change) }), { revalidate: false });
      setNotice(null);
    } catch {
      mutate(previous, { revalidate: false });
      setNotice(t.detail.saveFailed);
    }
  }

  function decide(verdict: Verdict | null) {
    const status = statusAfter(verdict, item!.status as Status);
    if (!verdict) return patch({ status, data: { verdict: null } });
    const against = d.verdict_suggested && d.verdict_suggested !== verdict ? `\n\n${t.detail.againstAi(t.verdict[d.verdict_suggested])}` : "";
    Alert.alert(t.detail.confirmTitle(t.verdict[verdict]), t.detail.confirmBody + against, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.detail.confirm, onPress: () => patch({ status, data: { verdict } }) },
    ]);
  }

  async function analyse() {
    setAnalysing(true);
    try {
      const job = await api<{ id: string }>(`${base}/analyze`, { method: "POST" });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        const j = await api<{ status: string }>(`/workspaces/${ws}/jobs/${job.id}`);
        if (j.status === "done" || j.status === "failed") break;
      }
      await mutate();
    } catch {
      setNotice(t.detail.analyseFailed);
    } finally {
      setAnalysing(false);
    }
  }

  async function addLink() {
    try {
      await api(`/workspaces/${ws}/sources`, { method: "POST", body: JSON.stringify({ item_id: id, url: link.trim() }) });
      setLink("");
      await Promise.all([mutateSources(), mutate()]);
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : t.detail.saveFailed);
    }
  }

  async function attach() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos", "images"], quality: 1, exif: true });
    const a = res.assets?.[0];
    if (res.canceled || !a) return;
    const mime = a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg");
    setUpload(0);
    try {
      await uploadFile(ws, { uri: a.uri, mime, name: a.fileName ?? `${a.type ?? "fichier"}.${mime.split("/")[1]}`, size: a.fileSize }, setUpload, id);
      await Promise.all([mutateSources(), mutate()]);
    } catch (e) {
      setNotice(e instanceof ApiError && e.code === "too_large" ? t.check.tooLarge : t.detail.saveFailed);
    } finally {
      setUpload(null);
    }
  }

  async function send() {
    try {
      await api(`${base}/comments`, { method: "POST", body: JSON.stringify({ body: comment.trim() }) });
      setComment("");
      await mutateComments();
    } catch {
      setNotice(t.detail.saveFailed);
    }
  }

  const a = d.analysis;
  const awaiting = !d.verdict && !!d.verdict_suggested;
  const sourceTitle = (sid?: string) => sources?.find((s) => s.id === sid)?.title;

  return (
    <>
    <Screen bottomInset={awaiting ? SIGN_BAR_ROOM + 48 : 48}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="tabular" style={{ fontSize: 20 }}>
          {d.ref ?? ""}
        </T>
        <View style={{ flex: 1 }} />
        <StatusLabel status={item.status} />
      </View>
      <T style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 29, letterSpacing: tracking(22) }}>{item.title}</T>
      {!!(d.origin || d.first_seen_at) && (
      <T tone="muted">
        {[d.origin ? t.detail.origin(t.origin[d.origin] ?? d.origin) : "", d.first_seen_at ? t.claims.since(span(d.first_seen_at)) : ""].filter(Boolean).join(" · ")}
      </T>
      )}
      {!!item.body && <T>{item.body}</T>}
      {notice && <Notice tone="error">{notice}</Notice>}

      <Section title={t.detail.verdict}>
        <View style={{ gap: 10 }}>
          {d.verdict ? <VerdictPanel verdict={d.verdict} /> : <T tone="muted">{t.verdict.none}</T>}
          {d.verdict_suggested && d.verdict_suggested !== d.verdict && <VerdictPanel verdict={d.verdict_suggested} suggested />}
        </View>
        <View style={{ gap: 8 }}>
          <T tone="muted">{t.detail.decide}</T>
          <View style={styles.wrap}>
            {VERDICTS.map((v) => {
              const Icon = VERDICT_ICON[v];
              const on = d.verdict === v;
              const tone = c.verdict[v];
              return (
                <Pressable
                  key={v}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => (on ? decide(null) : decide(v))}
                  style={{
                    flexBasis: "47%",
                    flexGrow: 1,
                    minHeight: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: radius.control,
                    borderWidth: on ? 0 : 1,
                    borderColor: tone.ink,
                    backgroundColor: on ? tone.fill : c.card,
                  }}
                >
                  <Icon size={18} color={on ? tone.on : tone.ink} />
                  <T style={{ fontFamily: fonts.semibold, color: on ? tone.on : tone.ink }}>{t.verdict[v]}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Section>

      {!!d.verdict && (
        <Section title={t.card.title}>
          <ShareVerdict
            key={d.verdict}
            ws={ws}
            item={item}
            verdict={d.verdict}
            sources={sources ?? []}
            desk={current?.name ?? t.app.name}
            onShared={() => item.status === "verified" && patch({ status: "published" })}
          />
        </Section>
      )}

      <Section title={t.detail.status}>
        <View style={styles.wrap}>
          {STATUSES.filter((s) => s !== "published" || item.status === "verified" || item.status === "published").map((s) => (
            <Chip key={s} label={t.status[s]} selected={item.status === s} onPress={() => item.status !== s && patch({ status: s })} />
          ))}
        </View>
      </Section>

      <Section title={t.detail.analysis}>
        {a ? (
          <Card>
            {!!a.reason && (
              <>
                <T tone="label">{t.detail.reason}</T>
                <T>{a.reason}</T>
              </>
            )}
            {a.evidence.map((e, i) => (
              <View key={i} style={{ gap: 2 }}>
                <T style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
                  {t.check.stance[e.stance] ?? e.stance}
                  {sourceTitle(e.source_id) ? ` · ${sourceTitle(e.source_id)}` : ""}
                </T>
                <T style={{ fontFamily: fonts.quote, fontSize: 17, lineHeight: 24 }}>« {e.quote} »</T>
              </View>
            ))}
            {!!a.missing && (
              <T tone="muted">
                {t.check.missing} : {a.missing}
              </T>
            )}
          </Card>
        ) : (
          (d.source_count ?? 0) === 0 && <T tone="muted">{t.detail.noSources}</T>
        )}
        <Button
          label={analysing ? t.detail.analysing : a ? t.detail.reanalyse : t.detail.analyse}
          variant="outline"
          busy={analysing}
          disabled={(d.source_count ?? 0) === 0}
          onPress={analyse}
        />
      </Section>

      <Section title={t.detail.sources}>
        {sources?.length ? (
          sources.map((s) => {
            const Icon = KIND_ICON[s.kind] ?? FileText;
            const target = s.url ?? s.file?.download_url;
            return (
              <Pressable key={s.id} disabled={!target} onPress={() => openWeb(target)} accessibilityRole={target ? "link" : undefined}>
                <Card style={{ flexDirection: "row", gap: 10 }}>
                  <Icon size={18} color={c.foreground} style={{ marginTop: 3 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T style={{ fontFamily: fonts.medium }} numberOfLines={2}>
                      {s.title}
                    </T>
                    <T tone="muted" numberOfLines={2}>
                      {s.status === "ready" ? s.excerpt || ago(s.created_at) : (t.detail.sourceStatus[s.status] ?? s.status)}
                    </T>
                  </View>
                </Card>
              </Pressable>
            );
          })
        ) : (
          <T tone="muted">{t.detail.noSourcesYet}</T>
        )}
        <Field placeholder={t.detail.linkPlaceholder} value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" onSubmitEditing={addLink} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label={t.detail.addLink} accessibilityLabel={t.detail.addLinkLong} icon={Link} variant="outline" disabled={!/^https?:\/\//i.test(link.trim())} onPress={addLink} style={{ flex: 1 }} />
          <Button
            label={upload !== null ? t.detail.uploading(t.check.percent(upload)) : t.detail.attachFile}
            accessibilityLabel={t.detail.attachFileLong}
            icon={Paperclip}
            variant="outline"
            busy={upload !== null}
            onPress={attach}
            style={{ flex: 1 }}
          />
        </View>
      </Section>

      <Section title={t.detail.comments}>
        {comments?.length ? (
          comments.map((m) => (
            <Card key={m.id} style={{ gap: 4 }}>
              <T tone="muted">
                {m.author_id === me?.id ? t.common.you : t.common.someone} · {ago(m.created_at)}
              </T>
              <T>{m.body}</T>
            </Card>
          ))
        ) : (
          <T tone="muted">{t.detail.noComments}</T>
        )}
        <Field placeholder={t.detail.commentPlaceholder} value={comment} onChangeText={setComment} multiline />
        <Button label={t.detail.send} disabled={!comment.trim()} onPress={send} />
      </Section>
    </Screen>
    {awaiting && d.verdict_suggested && <SignBar label={t.detail.signSuggested(t.verdict[d.verdict_suggested])} onPress={() => decide(d.verdict_suggested!)} />}
    </>
  );
}
