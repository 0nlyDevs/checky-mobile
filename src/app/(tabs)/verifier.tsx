import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { Button, Card, Field, Notice, Screen, Section, T } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { t } from "@/lib/i18n/fr";
import { postStream } from "@/lib/sse";
import { fonts, useTheme } from "@/lib/theme";
import { useWs } from "@/lib/workspace";

type Passage = { n: number; source_title?: string; title?: string; text: string };

/** Ask every source of the newsroom: the answer streams in, and cites its passages. */
export default function Ask() {
  const ws = useWs();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [passages, setPassages] = useState<Passage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function ask() {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError(null);
    setAnswer("");
    setPassages([]);
    try {
      await postStream(
        `/workspaces/${ws}/ask`,
        { question: question.trim() },
        (event, data) => {
          if (event === "citations") setPassages(((data as { passages?: Passage[] }).passages ?? (data as Passage[])) || []);
          else if (event === "delta") setAnswer((a) => a + ((data as { text?: string }).text ?? ""));
          else if (event === "error") setError(t.ask.failed);
        },
        ctrl.signal,
      );
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof ApiError && e.status === 503 ? t.ask.noEmbeddings : t.ask.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <T tone="title">{t.ask.title}</T>
        <T tone="muted">{t.ask.lead}</T>
      </View>
      <Field placeholder={t.ask.placeholder} value={question} onChangeText={setQuestion} multiline style={{ minHeight: 72, textAlignVertical: "top" }} />
      <Button label={t.ask.submit} busy={busy} disabled={question.trim().length < 2} onPress={ask} />
      {error && <Notice tone="error">{error}</Notice>}
      {!!answer && (
        <Card>
          <Answer text={answer} />
        </Card>
      )}
      {passages.length > 0 && (
        <Section title={t.ask.passages}>
          {passages.map((p) => (
            <Card key={p.n} style={{ gap: 4 }}>
              <T tone="label">
                [{p.n}] {p.source_title ?? p.title ?? ""}
              </T>
              <T numberOfLines={6}>{p.text}</T>
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}

/** **bold** and both [n] and 【n】 citations, as on the desk. */
function Answer({ text }: { text: string }) {
  const c = useTheme();
  const parts = text.replace(/【(\d+)[^】]*】/g, "[$1]").split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return (
    <Text style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: c.foreground }}>
      {parts.map((part, i) =>
        /^\*\*/.test(part) ? (
          <Text key={i} style={{ fontFamily: fonts.bold }}>
            {part.slice(2, -2)}
          </Text>
        ) : /^\[\d+\]$/.test(part) ? (
          <Text key={i} style={{ fontFamily: fonts.tabular, color: c.mutedForeground }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
