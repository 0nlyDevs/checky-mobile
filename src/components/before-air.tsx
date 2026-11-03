import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button, Card, Field, Notice, Section, Step, T, VerdictBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { handOff, openWeb } from "@/lib/handoff";
import { day, tr, useLang, useT } from "@/lib/i18n";
import { firstSentence } from "@/lib/i18n/core";
import { ArrowSquareOut, Broadcast, ClipboardText, MagnifyingGlass, Plus } from "@/lib/icons";
import { isNetworkError, isOnline } from "@/lib/network";
import { useOutbox } from "@/lib/outbox";
import { deviceCountry, type Match, publicApi, verdictLink } from "@/lib/public";
import { fonts, radius, tracking, useTheme } from "@/lib/theme";
import type { ClaimData, Item, Verdict } from "@/lib/types";
import { VERDICTS } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";

/** A verdict a newsroom has published: from any newsroom (public match), or only in this desk (`local`). */
type Hit = { id: string; local: boolean; verdict: Verdict; title: string; newsroom: string; date: string | null; reason: string };
type Result = { hits: Hit[]; following: Item[] };

const isVerdict = (v: unknown): v is Verdict => (VERDICTS as readonly unknown[]).includes(v);

/**
 * « Avant l'antenne » (brief 5.1): during a call-in show, the journalist repeats the caller's claim in one
 * sentence. Published verdicts come first (every newsroom's, then this newsroom's own), with a two-sentence
 * radio line to read on air. Without a published verdict nothing says « Faux »: the screen says what is
 * known (the desk may already follow it) and offers to follow it in the desk.
 */
export function BeforeAir() {
  const t = useT();
  const lang = useLang();
  const c = useTheme();
  const router = useRouter();
  const outbox = useOutbox();
  const { current } = useWorkspace();
  const ws = current?.workspace_id ?? "";
  const [claim, setClaim] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [asked, setAsked] = useState("");
  const [copied, setCopied] = useState(false);
  const [track, setTrack] = useState<{ state: "busy" | "done" | "queued" | "failed"; id?: string; ref?: string | null } | null>(null);
  const run = useRef(0);

  async function check() {
    const q = claim.trim();
    if (!q) return;
    const n = ++run.current;
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    setTrack(null);
    try {
      const [matched, similar] = await Promise.all([
        publicApi<Match[]>("/match", { method: "POST", body: JSON.stringify({ text: q.slice(0, 4000), country: deviceCountry() }) }),
        // The newsroom's own claims: a published one counts even when the newsroom is not public yet.
        api<{ score: number; item: Item }[]>(`/workspaces/${ws}/items/similar?q=${encodeURIComponent(q.slice(0, 600))}`).catch(() => []),
      ]);
      if (n !== run.current) return;
      const hits: Hit[] = matched
        .filter((m) => isVerdict(m.verdict.verdict))
        .map((m) => ({
          id: m.verdict.id,
          local: false,
          verdict: m.verdict.verdict as Verdict,
          title: m.verdict.title,
          newsroom: m.verdict.newsroom.name,
          date: m.verdict.published_at,
          reason: m.verdict.reason ?? "",
        }));
      const following: Item[] = [];
      for (const { item } of similar) {
        const d = item.data as ClaimData & { reason?: string; signed_at?: string };
        if (hits.some((h) => h.id === item.id)) continue;
        if (item.status === "published" && isVerdict(d.verdict)) {
          hits.push({ id: item.id, local: true, verdict: d.verdict, title: item.title, newsroom: current?.name ?? "", date: d.signed_at ?? item.updated_at, reason: d.reason ?? d.analysis?.reason ?? "" });
        } else {
          following.push(item);
        }
      }
      setResult({ hits, following });
      setAsked(q);
    } catch (e) {
      if (n === run.current) setError(e instanceof ApiError && e.status === 429 ? tr().antenne.tooMany : tr().antenne.failed);
    } finally {
      if (n === run.current) setBusy(false);
    }
  }

  async function follow() {
    const claimText = asked.slice(0, 300);
    setTrack({ state: "busy" });
    const later = () => {
      outbox.add({ kind: "claim", claim: { title: claimText, origin: "radio" } });
      setTrack({ state: "queued" });
    };
    if (!(await isOnline())) return later();
    try {
      // Same route as the copilot: the API assigns the next FAN ref.
      const made = await api<{ item_id: string; ref: string | null }>(`/workspaces/${ws}/copilot/act`, {
        method: "POST",
        body: JSON.stringify({ kind: "create_claim", title: claimText, origin: "radio" }),
      });
      setTrack({ state: "done", id: made.item_id, ref: made.ref });
    } catch (e) {
      if (isNetworkError(e) || !(await isOnline())) return later();
      setTrack({ state: "failed" });
    }
  }

  async function copy(text: string) {
    await Clipboard.setStringAsync(text).catch(() => null);
    setCopied(true);
  }

  const openClaim = (id: string) => router.push({ pathname: "/affirmation/[id]", params: { id } });
  const top = result?.hits[0];
  const line = top
    ? t.antenne.line(top.newsroom, top.title, t.verdict[top.verdict], firstSentence(top.reason))
    : t.antenne.unverifiedLine;

  return (
    <View style={{ gap: 16 }}>
      <T tone="muted">{t.antenne.lead}</T>
      <View style={{ gap: 6 }}>
        <Field
          placeholder={t.antenne.placeholder}
          value={claim}
          onChangeText={setClaim}
          multiline
          returnKeyType="search"
          style={{ minHeight: 72, textAlignVertical: "top" }}
          accessibilityLabel={t.antenne.title}
        />
        <T tone="muted">{t.antenne.dictate}</T>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={t.antenne.paste} icon={ClipboardText} variant="outline" style={{ flex: 1 }} onPress={async () => setClaim((await Clipboard.getStringAsync()).trim())} />
        <Button label={t.antenne.check} icon={MagnifyingGlass} style={{ flex: 1 }} busy={busy} disabled={!claim.trim()} onPress={check} />
      </View>
      {busy && (
        <Card>
          <Step label={t.antenne.checking} state="running" />
        </Card>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {result && top && (
        <View accessibilityRole="summary" style={{ gap: 12, padding: 16, borderRadius: radius.card, borderWidth: 2, borderColor: c.verdict[top.verdict].ink, backgroundColor: c.verdict[top.verdict].soft }}>
          <VerdictBadge verdict={top.verdict} large />
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: tracking(28), color: c.verdict[top.verdict].ink }}>
            {t.antenne.found(t.verdict[top.verdict])}
          </Text>
          <T style={{ fontFamily: fonts.semibold, color: c.verdict[top.verdict].ink }}>{t.antenne.by(top.newsroom, day(top.date, lang))}</T>
          <T style={{ color: c.verdict[top.verdict].ink }} numberOfLines={4}>
            « {top.title} »
          </T>
          <Button
            label={t.antenne.open}
            icon={ArrowSquareOut}
            variant="outline"
            onPress={() => (top.local ? openClaim(top.id) : openWeb(verdictLink(top.id)))}
          />
        </View>
      )}

      {result && !top && (
        <Section title={t.antenne.known}>
          <Card style={{ gap: 6 }}>
            <T style={{ fontFamily: fonts.semibold }}>{t.antenne.none}</T>
            <T>{t.antenne.noneLead}</T>
          </Card>
        </Section>
      )}

      {result && (
        <Section title={t.antenne.radioLine} note={top ? t.antenne.radioHint : undefined}>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Broadcast size={22} color={c.foreground} style={{ marginTop: 3, flexShrink: 0 }} />
              <T selectable style={{ flex: 1, fontSize: 19, lineHeight: 28, fontFamily: fonts.medium }}>
                {line}
              </T>
            </View>
            {lang === "mg" && !!t.antenne.mgNote && <T tone="muted">{t.antenne.mgNote}</T>}
            <Button label={copied ? t.antenne.copied : t.antenne.copy} icon={ClipboardText} variant="outline" onPress={() => copy(line)} />
          </Card>
        </Section>
      )}

      {result && result.hits.length > 1 && (
        <Section title={t.antenne.others}>
          {result.hits.slice(1, 4).map((h) => (
            <Pressable
              key={h.id}
              accessibilityRole="link"
              onPress={() => (h.local ? openClaim(h.id) : openWeb(verdictLink(h.id)))}
              style={({ pressed }) => ({ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.card, padding: 14, gap: 6, transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <VerdictBadge verdict={h.verdict} />
              <T style={{ fontFamily: fonts.semibold }} numberOfLines={3}>
                {h.title}
              </T>
              <T tone="muted">{t.antenne.by(h.newsroom, day(h.date, lang))}</T>
            </Pressable>
          ))}
        </Section>
      )}

      {result && !top && result.following.length > 0 && (
        <Section title={t.antenne.known}>
          {result.following.slice(0, 3).map((item) => (
            <Card key={item.id} style={{ gap: 8 }}>
              <T>{t.antenne.following((item.data as ClaimData).ref ?? "", t.status[item.status] ?? item.status)}</T>
              <T style={{ fontFamily: fonts.semibold }} numberOfLines={3}>
                {item.title}
              </T>
              <Button label={t.antenne.openClaim} variant="outline" onPress={() => openClaim(item.id)} />
            </Card>
          ))}
        </Section>
      )}

      {result && !top && (
        <View style={{ gap: 8 }}>
          {result.following.length === 0 && track?.state !== "done" && track?.state !== "queued" && (
            <Button label={t.antenne.track} icon={Plus} busy={track?.state === "busy"} onPress={follow} />
          )}
          {track?.state === "done" && (
            <>
              <Notice>{t.antenne.tracked(track.ref ?? "")}</Notice>
              <Button label={t.antenne.openClaim} variant="outline" onPress={() => track.id && openClaim(track.id)} />
            </>
          )}
          {track?.state === "queued" && <Notice>{t.outbox.queuedClaim}</Notice>}
          {track?.state === "failed" && <Notice tone="error">{t.antenne.trackFailed}</Notice>}
          <Button
            label={t.antenne.deeper}
            icon={MagnifyingGlass}
            variant="ghost"
            onPress={() => router.push({ pathname: "/analyse", params: { id: handOff({ text: asked }) } })}
          />
        </View>
      )}
    </View>
  );
}
