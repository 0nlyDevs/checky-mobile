import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentRef, useCallback, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Chip, Field, Notice, Step, T, styles } from "@/components/ui";
import { VoiceComposer } from "@/components/voice-composer";
import { AnswerVoice } from "@/components/answer-voice";
import { api, ApiError } from "@/lib/api";
import { WEB_URL } from "@/lib/config";
import { openWeb } from "@/lib/handoff";
import { tr, useLang, useT } from "@/lib/i18n";
import { ArrowLeft, ArrowSquareOut, Microphone, PaperPlaneTilt, Sparkle } from "@/lib/icons";
import { useMode } from "@/lib/mode";
import { myTips, publicApi, rememberTip } from "@/lib/public";
import { postStream } from "@/lib/sse";
import { fonts, radius, useTheme } from "@/lib/theme";
import { useWorkspace } from "@/lib/workspace";
import { goBack } from "@/lib/nav";
import { mobileRoute } from "@/lib/navigation";

type Cite = { n: number; title: string; url?: string | null; id?: string; verdict?: string };
/** A change the agent proposes; nothing happens until the person confirms it here. */
type Action = {
  id: number;
  kind: "tip" | "navigate" | "create_claim" | "attach_link" | "analyze" | "set_status";
  href?: string;
  label?: string;
  newsroom?: string;
  newsroom_name?: string;
  text?: string;
  url?: string | null;
  origin?: string;
  title?: string;
  item_id?: string;
  ref?: string | null;
  status?: string;
  state?: "pending" | "running" | "done" | "cancelled" | "failed";
  outcome?: string;
  link?: string;
};
type Turn = { id: number; question: string; answer: string; state: "thinking" | "done" | "error"; steps: string[]; cites?: Cite[]; actions?: Action[]; note?: string };

/** The numbers an answer cites, as [1], [1, 2] or 【1】: only those are listed under it. */
function cited(answer: string): Set<number> {
  const out = new Set<number>();
  for (const m of answer.matchAll(/[[【]([\d,\s]+)[\]】]/g)) for (const n of m[1].split(/[,\s]+/)) if (n) out.add(Number(n));
  return out;
}

/**
 * Checky's assistant, as on the web: without an account the visitors' guide (`/public/agent`:
 * published verdicts with citations, a tip drafted then sent by the citizen, the follow-up of their
 * tips, pages opened); in a newsroom the copilot (`/workspaces/{ws}/copilot`), whose proposals run
 * through `copilot/act` once the journalist confirms. It never states or confirms a verdict itself.
 */
export default function Assistant() {
  const t = useT();
  const c = useTheme();
  const lang = useLang();
  const router = useRouter();
  const { voice } = useLocalSearchParams<{ voice?: string }>();
  const [voiceMode, setVoiceMode] = useState(voice === "1");
  useFocusEffect(useCallback(() => { if (voice === "1") setVoiceMode(true); }, [voice]));
  const { bottom } = useSafeAreaInsets();
  const { mode } = useMode();
  const { current } = useWorkspace();
  const ws = mode === "journalist" ? (current?.workspace_id ?? null) : null;
  const desk = !!ws;
  const a = t.assistant;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const addDictation = useCallback((value: string) => setText(previous => previous.trim() ? `${previous}\n${value}` : value), []);
  const seq = useRef(0);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const busy = turns.some((x) => x.state === "thinking");

  const update = (id: number, patch: (x: Turn) => Partial<Turn>) => setTurns((all) => all.map((x) => (x.id === id ? { ...x, ...patch(x) } : x)));
  const patchAction = (turn: number, action: number, patch: Partial<Action>) =>
    update(turn, (x) => ({ actions: x.actions?.map((ac) => (ac.id === action ? { ...ac, ...patch } : ac)) }));

  function open(href: string) {
    const route = mobileRoute(href, desk);
    if (route) router.push(route as never);
    else openWeb(href.startsWith("http") ? href : `${WEB_URL}${href}`);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (q.length < 2 || busy) return;
    const a = tr().assistant;
    const id = ++seq.current;
    // The last three exchanges go with the question, as on the web.
    const past = turns.filter((x) => x.state === "done").slice(-3);
    const messages = [
      ...past.flatMap((x) => {
        const said = [x.answer, ...(x.actions ?? []).map((ac) => ac.outcome)].filter(Boolean).join(" ");
        return [{ role: "user", content: x.question.slice(0, 2000) }, ...(said ? [{ role: "assistant", content: said.slice(0, 2000) }] : [])];
      }),
      { role: "user", content: q.slice(0, 2000) },
    ];
    setTurns((all) => [...all, { id, question: q, answer: "", state: "thinking", steps: [] }]);
    setText("");
    const tips = ws ? [] : (await myTips()).map((x) => x.token);
    const body = { messages, lang, page: ws ? `/w/${ws}` : "/", tips, voice: voiceMode };
    let actions: Action[] = [];
    try {
      await postStream(
        ws ? `/workspaces/${ws}/copilot` : "/public/agent",
        body,
        (event, data) => {
          if (event === "step") update(id, (x) => ({ steps: [...x.steps, (data as { summary: string }).summary] }));
          else if (event === "answer") {
            const d = data as { text: string; citations: Cite[]; actions: Action[] };
            actions = (d.actions ?? []).map((ac) => ({ ...ac, state: ac.kind === "navigate" ? "done" : "pending" }));
            update(id, () => ({ answer: d.text ?? "", cites: d.citations ?? [], actions, state: "done" }));
          } else if (event === "error") update(id, () => ({ state: "error", note: (data as { code?: string }).code === "ai_unavailable" ? a.busy : a.failed }));
        },
        undefined,
        !!ws,
      );
    } catch (err) {
      update(id, () => ({ state: "error", note: err instanceof ApiError && err.status === 429 ? a.tooMany : a.failed }));
      return;
    }
    const go = actions.find((ac) => ac.kind === "navigate");
    if (go?.href) open(go.href);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }

  async function run(turn: number, ac: Action, confirmed: boolean) {
    const a = tr().assistant;
    if (!confirmed) return patchAction(turn, ac.id, { state: "cancelled", outcome: a.cancelled });
    patchAction(turn, ac.id, { state: "running" });
    try {
      if (ac.kind === "tip") {
        const res = await publicApi<{ token: string; ref: string; newsroom?: { name: string } | null }>("/tips", {
          method: "POST",
          body: JSON.stringify({ newsroom: ac.newsroom, text: ac.text, url: ac.url || undefined, origin: ac.origin ?? "other" }),
        });
        await rememberTip({
          token: res.token,
          ref: res.ref,
          title: (ac.text ?? "").split("\n")[0].slice(0, 300),
          newsroom: res.newsroom?.name ?? ac.newsroom_name ?? "",
          at: new Date().toISOString(),
        });
        patchAction(turn, ac.id, { state: "done", outcome: a.sent(res.ref), link: `/citizen/track/${res.token}` });
      } else if (ws) {
        const res = await api<{ item_id: string; ref: string | null }>(`/workspaces/${ws}/copilot/act`, {
          method: "POST",
          body: JSON.stringify({ kind: ac.kind, item_id: ac.item_id, title: ac.title, body: ac.text, origin: ac.origin, url: ac.url, status: ac.status }),
        });
        patchAction(turn, ac.id, { state: "done", outcome: res.ref ? `${a.done} ${res.ref}.` : a.done, link: `/claim/${res.item_id}` });
      }
    } catch (err) {
      const note = err instanceof ApiError && err.status === 403 ? a.forbidden : err instanceof ApiError && err.status === 429 ? a.tooMany : a.actFailed;
      patchAction(turn, ac.id, { state: "failed", outcome: note });
    }
  }

  const describe = (ac: Action) =>
    ac.kind === "create_claim"
      ? a.actions.create_claim(ac.title ?? "")
      : ac.kind === "attach_link"
        ? a.actions.attach_link(ac.url ?? "", ac.ref ?? "")
        : ac.kind === "analyze"
          ? a.actions.analyze(ac.ref ?? "")
          : ac.kind === "set_status"
            ? a.actions.set_status(ac.ref ?? "", t.status[ac.status ?? ""] ?? ac.status ?? "")
            : "";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior="padding">
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, gap: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={goBack} hitSlop={12} style={{ padding: 4 }}>
            <ArrowLeft size={24} color={c.foreground} />
          </Pressable>
          <T tone="title" style={{ flex: 1 }}>
            {a.title}
          </T>
          {turns.length > 0 && !busy && (
            <Pressable accessibilityRole="button" onPress={() => setTurns([])} hitSlop={8}>
              <T style={{ fontFamily: fonts.semibold, textDecorationLine: "underline", fontSize: 14 }}>{a.clear}</T>
            </Pressable>
          )}
        </View>

        {turns.length === 0 && (
          <View style={{ gap: 12 }}>
            <T tone="muted">{desk ? a.leadDesk : a.leadPublic}</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(desk ? a.suggestionsDesk : a.suggestionsPublic).map((s) => (
                <Chip key={s} label={s} onPress={() => ask(s)} />
              ))}
            </View>
          </View>
        )}

        {turns.map((x) => {
          const used = x.cites?.filter((ci) => cited(x.answer).has(ci.n)) ?? [];
          return (
            <View key={x.id} style={{ gap: 10 }}>
              <View style={{ alignSelf: "flex-end", maxWidth: "88%", backgroundColor: c.primary, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10 }}>
                <T style={{ color: c.primaryForeground }}>{x.question}</T>
              </View>
              {x.state === "thinking" && (
                <View style={{ gap: 4 }}>
                  <Step label={a.thinking} state="running" />
                  {x.steps.map((s, i) => (
                    <Step key={i} label={s} state="done" />
                  ))}
                </View>
              )}
              {x.state === "error" && <Notice tone="error">{x.note ?? a.failed}</Notice>}
              {x.state === "done" && (
                <View style={{ gap: 10 }}>
                  {!!x.answer && <T style={{ fontSize: 16, lineHeight: 24 }}>{x.answer.replace(/【(\d+)[^】]*】/g, "[$1]").replace(/\*\*(.+?)\*\*/g, "$1")}</T>}
                  {!!x.answer && <AnswerVoice text={x.answer} />}
                  {used.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <T tone="label">{a.files}</T>
                      {used.map((ci) => (
                        <Pressable
                          key={ci.n}
                          accessibilityRole="link"
                          onPress={() => (ci.id && ci.verdict ? router.push({ pathname: "/citizen/verdict/[id]", params: { id: ci.id } }) : openWeb(ci.url))}
                          style={[styles.row, { gap: 6 }]}
                        >
                          <T style={{ flex: 1, textDecorationLine: "underline" }} numberOfLines={2}>
                            [{ci.n}] {ci.title}
                          </T>
                          {!ci.id && !!ci.url && <ArrowSquareOut size={16} color={c.foreground} />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {x.actions
                    ?.filter((ac) => ac.kind !== "navigate")
                    .map((ac) => (
                      <View key={ac.id} style={{ borderWidth: 1, borderStyle: "dashed", borderColor: c.foreground, borderRadius: radius.card, padding: 14, gap: 8 }}>
                        <T style={{ fontFamily: fonts.bold }}>{ac.kind === "tip" ? a.tipTitle : a.proposal}</T>
                        {ac.kind === "tip" ? (
                          <>
                            {!!ac.newsroom_name && <T tone="muted">{a.tipTo(ac.newsroom_name)}</T>}
                            <Field
                              label={a.tipText}
                              value={ac.text ?? ""}
                              editable={ac.state === "pending"}
                              onChangeText={(v) => patchAction(x.id, ac.id, { text: v })}
                              multiline
                              style={{ minHeight: 80, textAlignVertical: "top" }}
                            />
                          </>
                        ) : (
                          <T>{describe(ac)}</T>
                        )}
                        {ac.state === "pending" || ac.state === "running" ? (
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Button
                              label={ac.state === "running" ? a.working : ac.kind === "tip" ? a.sendTip : a.confirm}
                              busy={ac.state === "running"}
                              style={{ flex: 1 }}
                              onPress={() => run(x.id, ac, true)}
                            />
                            <Button label={a.cancel} variant="outline" style={{ flex: 1 }} disabled={ac.state === "running"} onPress={() => run(x.id, ac, false)} />
                          </View>
                        ) : (
                          <>
                            {!!ac.outcome && <T tone={ac.state === "failed" ? "default" : "muted"}>{ac.outcome}</T>}
                            {ac.state === "done" && !!ac.link && (
                              <Button label={ac.kind === "tip" ? a.follow : a.openIt} variant="outline" onPress={() => router.push(ac.link as never)} />
                            )}
                          </>
                        )}
                      </View>
                    ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: bottom + 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background, gap: 10 }}>
      {voiceMode && <VoiceComposer onText={addDictation} disabled={busy} />}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.navigation.dictate} accessibilityState={{ selected: voiceMode }} onPress={() => setVoiceMode(!voiceMode)} style={{ minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center" }}><Microphone size={23} color={c.foreground} /></Pressable>
        <View style={{ flex: 1 }}>
          <Field placeholder={a.placeholder} value={text} onChangeText={setText} multiline style={{ maxHeight: 120 }} accessibilityLabel={a.placeholder} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.send}
          disabled={busy || text.trim().length < 2}
          onPress={() => ask(text)}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.primary,
            opacity: busy || text.trim().length < 2 ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? <Sparkle size={22} color={c.primaryForeground} /> : <PaperPlaneTilt size={22} color={c.primaryForeground} />}
        </Pressable>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}
