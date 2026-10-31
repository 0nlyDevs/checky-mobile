import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Send } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { PublicVerdictRow } from "@/components/public-verdict-row";
import { Button, Card, Field, Notice, Screen, Section, Step, T, styles } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { handOff, pickUp } from "@/lib/handoff";
import { t } from "@/lib/i18n/fr";
import { type Ask, type Match, type PublicVerdict, publicApi } from "@/lib/public";
import { fonts, useTheme } from "@/lib/theme";

/** "Est-ce déjà vérifié ?" for something a citizen shared or pasted. Only verdicts a newsroom has
 * published are shown, never an AI verdict; with nothing found, the citizen can send a tip. */
export default function CitizenCheck() {
  const c = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const job = pickUp(id);
  const [query, setQuery] = useState((job?.text ?? job?.url ?? "").trim());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Ask | null>(null);
  const [verdicts, setVerdicts] = useState<PublicVerdict[] | null>(null);
  const started = useRef(false);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    setVerdicts(null);
    try {
      const [asked, matched] = await Promise.all([
        publicApi<Ask>("/ask", { method: "POST", body: JSON.stringify({ question: q.slice(0, 2000) }) }).catch((e) => {
          if (e instanceof ApiError && e.status === 429) throw e;
          return null;
        }),
        publicApi<Match[]>("/match", { method: "POST", body: JSON.stringify({ text: q.slice(0, 4000) }) }),
      ]);
      setAnswer(asked);
      // The assistant's cited verdicts first, then any other close match.
      const all = [...((asked?.verdicts ?? []) as PublicVerdict[]), ...matched.map((m) => m.verdict)];
      setVerdicts(all.filter((v, i) => all.findIndex((x) => x.id === v.id) === i).slice(0, 6));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429 ? t.citizen.tooMany : t.citizen.failed);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (started.current || !query) return;
    started.current = true;
    void run(query);
  }, [query, run]);

  const found = !!verdicts?.length;
  const fileOnly = !!job?.file && !job.text && !job.url;

  return (
    <Screen>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.cancel} onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="title" style={{ flex: 1 }}>
          {t.citizen.title}
        </T>
      </View>
      {fileOnly && <Notice>{t.citizen.fileOnly}</Notice>}
      <Field label={t.citizen.describe} value={query} onChangeText={setQuery} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
      <Button label={t.citizen.check} busy={busy} disabled={!query.trim()} onPress={() => run(query)} />
      {busy && (
        <Card>
          <Step label={t.citizen.checking} state="running" />
        </Card>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {!!answer?.answer && (
        <Section title={t.citizen.answer}>
          <Card>
            <Text style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: c.foreground }}>{answer.answer.replace(/【(\d+)[^】]*】/g, "[$1]")}</Text>
          </Card>
        </Section>
      )}

      {verdicts && (
        <Section title={found ? t.citizen.found : t.citizen.notFound}>
          {found ? (
            verdicts.map((v, i) => <PublicVerdictRow key={v.id} v={v} n={answer?.verdicts?.length ? i + 1 : undefined} />)
          ) : (
            <T>{t.citizen.notFoundLead}</T>
          )}
        </Section>
      )}

      {(verdicts || fileOnly) && (
        <Button
          label={t.citizen.report}
          icon={Send}
          variant={found ? "outline" : "primary"}
          onPress={() => router.push({ pathname: "/citoyen/signaler", params: { id: handOff({ text: job?.url && query === job.url ? "" : query, url: job?.url }) } })}
        />
      )}
    </Screen>
  );
}
