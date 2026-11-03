import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ArrowSquareOut, PaperPlaneTilt, SealCheck } from "@/lib/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ImageCheckCard } from "@/components/image-check";
import { PublicVerdictRow } from "@/components/public-verdict-row";
import { Button, Card, Field, Notice, Screen, Section, Step, T, styles } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { handOff, openWeb, pickUp } from "@/lib/handoff";
import { day, tr, useLang, useT } from "@/lib/i18n";
import { deviceCountry, type Fact, publicApi, type Review, type Verify } from "@/lib/public";
import { fonts, radius, useTheme } from "@/lib/theme";
import { goBack } from "@/lib/nav";

const LONE_URL = /^https?:\/\/\S+$/i;

/** « Est-ce déjà vérifié ? », as on the web's public site: Checky looks in three layers, in order:
 * a verdict a newsroom signed, a fact-checker's published review, then what is already known (the
 * original text, an official figure, the first appearance, the tone). No machine verdict and no
 * percentage ever reach a citizen. A shared photo also gets the public image check's hints. */
export default function CitizenCheck() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const job = pickUp(id);
  const image = job?.file && job.file.mime.startsWith("image/") ? job.file : null;
  const video = job?.file && !image ? job.file : null;
  const [query, setQuery] = useState((job?.text ?? job?.url ?? "").trim());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Verify | null>(null);
  const [asked, setAsked] = useState("");
  const started = useRef(false);

  const run = useCallback(async (q: string) => {
    const t = tr();
    const value = q.trim();
    if (value.length < 3) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = LONE_URL.test(value) ? { url: value } : { text: value.slice(0, 6000) };
      setResult(await publicApi<Verify>("/verify", { method: "POST", body: JSON.stringify({ ...body, country: deviceCountry() }) }));
      setAsked(value);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setError(status === 429 ? t.citizen.tooMany : status === 503 || status === 504 ? t.publicCheck.busy : t.citizen.failed);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (started.current || !query) return;
    started.current = true;
    void run(query);
  }, [query, run]);

  const report = () =>
    router.push({ pathname: "/citoyen/signaler", params: { id: handOff({ text: job?.url && query === job.url ? "" : query, url: job?.url }) } });

  return (
    <Screen>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={goBack} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="title" style={{ flex: 1 }}>
          {t.citizen.title}
        </T>
      </View>

      {image && <ImageCheckCard file={image} />}
      {video && <Notice>{t.image.video}</Notice>}

      <Field label={t.citizen.describe} value={query} onChangeText={setQuery} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
      <Button label={t.citizen.check} busy={busy} disabled={query.trim().length < 3} onPress={() => run(query)} />

      {busy && (
        // The three places Checky looks, in the order it looks; no fake progress.
        <Card>
          {t.publicCheck.layers.map((layer, i) => (
            <Step key={layer} label={`${String(i + 1).padStart(2, "0")}  ${layer}`} state={i === 0 ? "running" : "waiting"} />
          ))}
        </Card>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {result &&
        (result.status === "signed" && result.signed ? (
          <Section title={t.publicCheck.signedTitle}>
            <PublicVerdictRow v={result.signed} />
          </Section>
        ) : result.status === "external" && result.external?.length ? (
          <External reviews={result.external} />
        ) : (
          <Known result={result} asked={asked} onAsk={report} />
        ))}

      {!result && !busy && (video || image) && <Button label={t.publicCheck.ask} icon={PaperPlaneTilt} variant="outline" onPress={report} />}
    </Screen>
  );
}

/** Case 2: a fact-checker already published a review. Relayed as theirs, in their own words. */
function External({ reviews }: { reviews: Review[] }) {
  const t = useT();
  const c = useTheme();
  const p = t.publicCheck;
  return (
    <Section title={p.externalTitle} note={p.relayed}>
      {reviews.map((r) => (
        <View key={r.url} style={{ borderWidth: 2, borderColor: c.foreground, borderRadius: radius.card, backgroundColor: c.card, padding: 14, gap: 8 }}>
          <View style={[styles.row, { gap: 8 }]}>
            <SealCheck size={20} color={c.foreground} />
            <T style={{ fontFamily: fonts.semibold, flex: 1 }}>{p.externalBy(r.publisher, r.date ? day(r.date) : null)}</T>
          </View>
          <T style={{ fontSize: 17, lineHeight: 24 }}>{r.title}</T>
          {r.rating && <T style={{ fontFamily: fonts.bold, fontSize: 17 }}>{p.rating(r.rating)}</T>}
          <Pressable accessibilityRole="link" onPress={() => openWeb(r.url)} hitSlop={8} style={[styles.row, { gap: 6, alignSelf: "flex-start" }]}>
            <T style={{ fontFamily: fonts.semibold, textDecorationLine: "underline" }}>{p.read}</T>
            <ArrowSquareOut size={16} color={c.foreground} />
          </Pressable>
        </View>
      ))}
      <T style={{ fontFamily: fonts.semibold }}>{p.noNeed}</T>
    </Section>
  );
}

/** Cases 3 and 4: what is known, with source and date; no verdict yet; ask a newsroom; tell me. */
function Known({ result, asked, onAsk }: { result: Verify; asked: string; onAsk: () => void }) {
  const t = useT();
  const c = useTheme();
  const p = t.publicCheck;
  // The tone's signs get their own box, first: what the citizen can see for themselves.
  const tone = (result.known ?? []).find((x) => x.kind === "tone" && x.signals?.length);
  const known = (result.known ?? []).filter((x) => x !== tone);
  return (
    <>
      {tone && <Alert fact={tone} />}
      {known.length ? (
        <Section title={p.factsTitle}>
          {known.map((fact, i) => (
            <FactRow key={`${fact.kind}-${i}`} fact={fact} />
          ))}
        </Section>
      ) : (
        <Section title={p.none}>
          <T tone="muted">{p.noneLead}</T>
        </Section>
      )}
      {result.search_status === "unavailable" && <T tone="muted">{p.searchDown}</T>}
      <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: c.foreground, borderRadius: radius.card, padding: 14, gap: 4 }}>
        <T style={{ fontFamily: fonts.bold, fontSize: 17 }}>{p.noVerdict}</T>
        {result.followed_since && <T>{p.following(day(result.followed_since), result.followed_by ?? null)}</T>}
      </View>
      <Card>
        <T style={{ fontFamily: fonts.bold, fontSize: 17 }}>{p.ask}</T>
        <T tone="muted">{p.askLead}</T>
        <Button label={p.ask} icon={PaperPlaneTilt} onPress={onAsk} />
      </Card>
      <Notify text={asked} />
    </>
  );
}

/** « Ce qui doit vous alerter »: each sign the tone lexicon found in the message, with its words.
 * Found in code, no model; it says nothing of truth. */
function Alert({ fact }: { fact: Fact }) {
  const t = useT();
  const c = useTheme();
  const a = t.publicCheck.alert;
  return (
    <View style={{ borderWidth: 2, borderColor: c.foreground, borderRadius: radius.card, backgroundColor: c.card, padding: 14, gap: 8 }}>
      <T style={{ fontFamily: fonts.bold, fontSize: 18 }}>{a.title}</T>
      {!!fact.level && <T style={{ fontFamily: fonts.semibold }}>{a.level[fact.level] ?? fact.level}</T>}
      {(fact.signals ?? []).map((sg, i) => (
        <T key={`${sg.kind}-${i}`}>
          <Text style={{ fontFamily: fonts.semibold }}>{a.kinds[sg.kind] ?? sg.kind}</Text>
          {"  "}
          <Text style={{ fontFamily: fonts.quote, fontSize: 18 }}>« {sg.quote} »</Text>
        </T>
      ))}
      <T tone="muted" style={{ fontSize: 13 }}>
        {a.lead}
      </T>
    </View>
  );
}

function FactRow({ fact }: { fact: Fact }) {
  const t = useT();
  const c = useTheme();
  const p = t.publicCheck;
  const changed = (fact.diff ?? []).filter((d) => d.op !== "equal").slice(0, 4);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 10, gap: 4 }}>
      <T style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{p.kinds[fact.kind] ?? fact.kind}</T>
      <T>{fact.text}</T>
      {changed.length > 0 && (
        <View style={{ gap: 2, marginTop: 4 }}>
          <T style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{p.diff}</T>
          {changed.map((d, i) => (
            <View key={i} style={{ gap: 2 }}>
              {!!d.a && (
                <T tone="muted" style={{ fontSize: 14 }}>
                  {p.removed} : <Text style={{ textDecorationLine: "line-through" }}>{String(d.a)}</Text>
                </T>
              )}
              {!!d.b && (
                <T style={{ fontSize: 14 }}>
                  {p.added} : <Text style={{ fontFamily: fonts.bold }}>{String(d.b)}</Text>
                </T>
              )}
            </View>
          ))}
        </View>
      )}
      {(fact.source || fact.date || fact.url) && (
        <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
          <T tone="muted" style={{ fontSize: 14 }}>
            {[fact.source, fact.date ? day(fact.date) : null].filter(Boolean).join(" · ")}
          </T>
          {!!fact.url && (
            <Pressable accessibilityRole="link" onPress={() => openWeb(fact.url)} hitSlop={8}>
              <T style={{ fontSize: 14, fontFamily: fonts.semibold, textDecorationLine: "underline" }}>{p.openSource}</T>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/** « Me prévenir »: a phone number (or e-mail) to receive the verdict once a newsroom signs it. */
function Notify({ text }: { text: string }) {
  const t = useT();
  const lang = useLang();
  const n = t.publicCheck.notify;
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const n = tr().publicCheck.notify;
    setBusy(true);
    setError(null);
    try {
      const res = await publicApi<{ masked: string; channel: "sms" | "email" }>("/notify", {
        method: "POST",
        body: JSON.stringify({ text: text.slice(0, 2000), contact: contact.trim(), lang }),
      });
      setDone(res.channel === "sms" ? n.sms(res.masked) : n.email);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setError(
        status === 422 ? n.invalid : status === 409 ? n.noNewsroom : status === 429 ? tr().citizen.tooMany : status === 503 ? n.unavailable : n.failed,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!text) return null;
  return (
    <Card>
      <T style={{ fontFamily: fonts.bold, fontSize: 17 }}>{n.title}</T>
      {done ? (
        <T accessibilityLiveRegion="polite">{done}</T>
      ) : (
        <>
          <T tone="muted">{n.lead}</T>
          <Field label={n.label} value={contact} onChangeText={setContact} keyboardType="phone-pad" autoComplete="tel" placeholder={n.placeholder} />
          <Button label={n.submit} variant="outline" busy={busy} disabled={contact.trim().length < 5} onPress={send} />
          {error && <Notice tone="error">{error}</Notice>}
          <T tone="muted" style={{ fontSize: 13 }}>
            {n.privacy}
          </T>
        </>
      )}
    </Card>
  );
}
