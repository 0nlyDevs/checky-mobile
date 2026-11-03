import { BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { CormorantGaramond_500Medium_Italic } from "@expo-google-fonts/cormorant-garamond";
import * as Clipboard from "expo-clipboard";
import { createURL } from "expo-linking";
import { useFonts } from "expo-font";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Pressable, ScrollView, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, Chip, Notice, Step, T, VerdictBadge, VerdictPanel, styles } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { fingerprint, rememberOffer } from "@/lib/clip";
import { debunkText } from "@/lib/debunk";
import { handOff } from "@/lib/handoff";
import { tr, useLangReady, useT } from "@/lib/i18n";
import { guessLang, otherLang } from "@/lib/lang";
import { type Match, publicApi, type PublicVerdict, verdictLink } from "@/lib/public";
import { postStream } from "@/lib/sse";
import { fonts, radius, useTheme } from "@/lib/theme";
import type { CheckResult, Me, Verdict } from "@/lib/types";
import { finishSelection, type SelectionRequest } from "../../modules/checky-text";

type Action = NonNullable<SelectionRequest["action"]>;
type Desk = { ws: string } | null;

/** The newsroom of the signed-in journalist, as the app picked it; null for a citizen or signed out. */
async function deskOf(): Promise<Desk> {
  try {
    if ((await SecureStore.getItemAsync("fanilo.mode")) === "citizen") return null;
    const me = await api<Me>("/me");
    const chosen = await SecureStore.getItemAsync("fanilo.workspace").catch(() => null);
    const m = me.memberships.find((x) => x.workspace_id === chosen) ?? me.memberships[0];
    return m ? { ws: m.workspace_id } : null;
  } catch {
    return null;
  }
}

/** Copied from the sheet: the app will not offer to check its own text when it next opens. */
async function copy(text: string) {
  await Clipboard.setStringAsync(text);
  try {
    const next = rememberOffer(await SecureStore.getItemAsync("fanilo.clip"), fingerprint(text.trim()));
    if (next) await SecureStore.setItemAsync("fanilo.clip", next);
  } catch {
    // the offer may come once more: harmless
  }
}

const isLink = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

/** Rendered by ProcessTextActivity (`checky-sheet`) over the app the journalist is in. */
export function ProcessTextSheet(props: SelectionRequest) {
  const [loaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    CormorantGaramond_500Medium_Italic,
  });
  // The stored language is read first, like the app's root layout.
  const langReady = useLangReady();
  if (!loaded || !langReady) return null;
  return (
    <SafeAreaProvider>
      <Sheet text={(props.text ?? "").trim()} readOnly={props.readOnly !== false} action={props.action ?? "check"} />
    </SafeAreaProvider>
  );
}

function Sheet({ text, readOnly, action: initial }: { text: string; readOnly: boolean; action: Action }) {
  const t = useT();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [action, setAction] = useState<Action>(initial);
  const [desk, setDesk] = useState<Desk | undefined>(undefined);
  const close = useCallback((replacement: string | null = null) => void finishSelection(replacement), []);

  useEffect(() => {
    void deskOf().then(setDesk);
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.sheet.back} onPress={() => close()} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <Animated.View
        entering={SlideInDown.duration(220)}
        style={{ maxHeight: "86%", backgroundColor: c.background, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingBottom: insets.bottom + 12 }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginTop: 10 }} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
          <T style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30 }}>{t.sheet.titles[action]}</T>
          {action === "clipboard" ? null : text ? (
            <View style={{ gap: 4 }}>
              <T tone="label">{t.sheet.selection}</T>
              <T style={{ fontFamily: fonts.quote, fontSize: 18, lineHeight: 24 }} numberOfLines={4}>
                « {text} »
              </T>
            </View>
          ) : (
            <Notice>{t.sheet.empty}</Notice>
          )}
          {action === "clipboard" && desk !== undefined && <ClipboardPart desk={desk} />}
          {!!text && desk !== undefined && action === "check" && <CheckPart text={text} desk={desk} close={close} />}
          {!!text && desk !== undefined && action === "translate" && <TranslatePart text={text} desk={desk} readOnly={readOnly} close={close} />}
          {!!text && action === "debunk" && <DebunkPart text={text} readOnly={readOnly} close={close} onCheck={() => setAction("check")} />}
          {!!text && desk === undefined && action !== "debunk" && <Step label={t.common.loading} state="running" />}
          <Button label={t.sheet.back} variant="outline" onPress={() => close()} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/** Tile, shortcut and widget: nothing is read until the journalist taps « Vérifier » (Android only
 * lets the app in front read the clipboard, and this keeps it deliberate). */
function ClipboardPart({ desk }: { desk: Desk }) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  async function read() {
    const value = ((await Clipboard.getStringAsync().catch(() => "")) ?? "").trim();
    if (!value) return setEmpty(true);
    setEmpty(false);
    setText(value.slice(0, 4000));
  }

  if (text) {
    return (
      <>
        <View style={{ gap: 4 }}>
          <T tone="label">{t.sheet.selection}</T>
          <T style={{ fontFamily: fonts.quote, fontSize: 18, lineHeight: 24 }} numberOfLines={4}>
            « {text} »
          </T>
        </View>
        <CheckPart text={text} desk={desk} close={() => void finishSelection(null)} />
      </>
    );
  }
  return (
    <>
      <T tone="muted">{t.sheet.clipboardLead}</T>
      {empty && <Notice>{t.sheet.clipboardEmpty}</Notice>}
      <Button label={t.sheet.clipboardCheck} onPress={() => void read()} />
    </>
  );
}

/** Opens the full app on a screen, then closes the sheet. The check is handed over in memory:
 * the sheet and the app share one JS runtime (same React host). */
async function openInApp(path: "analyse" | "citoyen/verifier", id: string, close: () => void) {
  await Linking.openURL(createURL(`/${path}`, { queryParams: { id } })).catch(() => null);
  close();
}

/** « Checky »: a journalist gets the link check (the reading, dashed) and any published verdict;
 * a citizen only published verdicts, never a reading. */
function CheckPart({ text, desk, close }: { text: string; desk: Desk; close: () => void }) {
  const t = useT();
  const [published, setPublished] = useState<PublicVerdict[] | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = tr();
    publicApi<Match[]>("/match", { method: "POST", body: JSON.stringify({ text: text.slice(0, 4000) }) })
      .then((m) => setPublished(m.map((x) => x.verdict)))
      .catch(() => setPublished([]));
    if (!desk) return;
    const body = isLink(text) ? { url: text.trim() } : { text: text.slice(0, 6000) };
    postStream(`/workspaces/${desk.ws}/link-check`, body, (event, data) => {
      if (event === "step") {
        const d = data as { key: string; status: string };
        if (d.status === "running") setStep(t.check.steps[d.key] ?? d.key);
      } else if (event === "result") {
        setResult(data as CheckResult);
        setStep(null);
      } else if (event === "error") {
        setError((data as { code?: string }).code === "ai_unavailable" ? t.check.busy : t.check.failed);
        setStep(null);
      }
    }).catch((e) => {
      setError(e instanceof ApiError && e.status === 429 ? t.check.tooMany : t.sheet.failed);
      setStep(null);
    });
  }, [text, desk]);

  const a = result?.analysis;
  const seeAll = () => {
    const check = isLink(text) ? { url: text.trim() } : { text };
    void openInApp(desk ? "analyse" : "citoyen/verifier", handOff({ ...check, result: result ?? undefined }), close);
  };

  return (
    <>
      {published === null && !desk && <Step label={t.citizen.checking} state="running" />}
      {!!published?.length && (
        <View style={{ gap: 8 }}>
          <T tone="label">{t.sheet.published}</T>
          {published.map((v) => (
            <Card key={v.id} style={{ gap: 6 }}>
              <VerdictBadge verdict={v.verdict as Verdict} />
              <T style={{ fontFamily: fonts.semibold }} numberOfLines={3}>
                {v.title}
              </T>
              <T tone="muted">{t.sheet.by(v.newsroom.name)}</T>
            </Card>
          ))}
        </View>
      )}
      {published?.length === 0 && !desk && <T>{t.sheet.noPublished}</T>}
      {step && <Step label={step} state="running" />}
      {error && <Notice tone="error">{error}</Notice>}
      {result?.tracked && <Notice>{t.check.tracked(result.tracked.ref ?? result.tracked.title)}</Notice>}
      {!!result?.claims?.length && <T style={{ fontFamily: fonts.semibold }}>{result.claims[0]}</T>}
      {a && (
        <VerdictPanel verdict={a.verdict} suggested>
          {!!a.reason && <T numberOfLines={6}>{a.reason}</T>}
          <T tone="muted">{t.check.humanConfirms}</T>
        </VerdictPanel>
      )}
      {result && !a && !!result.claims?.length && <Notice>{t.check.noVerdict}</Notice>}
      {(result || error || published !== null) && <Button label={t.sheet.seeAll} onPress={seeAll} />}
    </>
  );
}

/** « Traduire FR ↔ MG »: the translation replaces the selection; Malagasy only once reread. */
function TranslatePart({ text, desk, readOnly, close }: { text: string; desk: Desk; readOnly: boolean; close: (s?: string | null) => void }) {
  const t = useT();
  const c = useTheme();
  const [to, setTo] = useState<"fr" | "mg">(() => otherLang(guessLang(text)));
  const [out, setOut] = useState<{ text: string; to: "fr" | "mg"; reread_needed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reread, setReread] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!desk) return;
    let live = true;
    const t = tr();
    api<{ text: string; to: "fr" | "mg"; reread_needed: boolean }>(`/workspaces/${desk.ws}/translate`, { method: "POST", body: JSON.stringify({ text: text.slice(0, 4000), to }) })
      .then((r) => live && setOut(r))
      .catch((e) => live && setError(e instanceof ApiError && e.code === "ai_unavailable" ? t.check.busy : e instanceof ApiError && e.status === 429 ? t.check.tooMany : t.sheet.failed));
    return () => {
      live = false;
    };
  }, [desk, text, to]);

  const choose = (lang: "fr" | "mg") => {
    if (lang === to) return;
    setOut(null);
    setError(null);
    setReread(false);
    setTo(lang);
  };
  if (!desk) return <Notice>{t.sheet.signIn}</Notice>;
  const blocked = !!out?.reread_needed && !reread;
  return (
    <>
      <View style={styles.row}>
        <Chip label={t.sheet.toMg} selected={to === "mg"} onPress={() => choose("mg")} />
        <Chip label={t.sheet.toFr} selected={to === "fr"} onPress={() => choose("fr")} />
      </View>
      {!out && !error && <Step label={t.sheet.translating} state="running" />}
      {error && <Notice tone="error">{error}</Notice>}
      {out && (
        <Card style={{ gap: 8 }}>
          {out.reread_needed && (
            <View style={{ alignSelf: "flex-start", borderWidth: 1, borderStyle: "dashed", borderColor: c.foreground, borderRadius: radius.tag, paddingHorizontal: 8, paddingVertical: 2 }}>
              <T style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{t.sheet.reread}</T>
            </View>
          )}
          <T selectable>{out.text}</T>
          {out.reread_needed && <T tone="muted">{t.sheet.rereadNote}</T>}
        </Card>
      )}
      {out?.reread_needed && <Chip label={t.sheet.rereadDone} selected={reread} onPress={() => setReread((r) => !r)} />}
      {out && readOnly && <Notice>{t.sheet.readOnly}</Notice>}
      {out &&
        (readOnly ? (
          <Button
            label={copied ? t.sheet.copied : t.sheet.copy}
            disabled={blocked}
            onPress={() => void copy(out.text).then(() => setCopied(true))}
          />
        ) : (
          <Button label={t.sheet.replace} disabled={blocked} onPress={() => close(out.text)} />
        ))}
    </>
  );
}

/** « Remplacer par le démenti »: only a verdict a newsroom published, picked by the journalist. */
function DebunkPart({ text, readOnly, close, onCheck }: { text: string; readOnly: boolean; close: (s?: string | null) => void; onCheck: () => void }) {
  const t = useT();
  const [found, setFound] = useState<PublicVerdict[] | null>(null);
  const [error, setError] = useState(false);
  const [pick, setPick] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    publicApi<Match[]>("/match", { method: "POST", body: JSON.stringify({ text: text.slice(0, 4000) }) })
      .then((m) => setFound(m.map((x) => x.verdict)))
      .catch(() => setError(true));
  }, [text]);

  if (error) return <Notice tone="error">{t.sheet.failed}</Notice>;
  if (!found) return <Step label={t.citizen.checking} state="running" />;
  if (!found.length) {
    return (
      <>
        <T>{t.sheet.debunkNone}</T>
        <Button label={t.sheet.checkInstead} variant="outline" onPress={onCheck} />
      </>
    );
  }
  const v = found[Math.min(pick, found.length - 1)];
  const replacement = debunkText(v, t.verdict[v.verdict] ?? v.verdict, verdictLink(v.id), t.sheet.by);
  return (
    <>
      {found.length > 1 && <T tone="label">{t.sheet.pick}</T>}
      {found.length > 1 &&
        found.map((x, i) => (
          <Pressable key={x.id} accessibilityRole="radio" accessibilityState={{ checked: i === pick }} onPress={() => setPick(i)}>
            <Card style={{ gap: 6, borderWidth: i === pick ? 2 : 1 }}>
              <VerdictBadge verdict={x.verdict as Verdict} />
              <T numberOfLines={2}>{x.title}</T>
            </Card>
          </Pressable>
        ))}
      <T>{t.sheet.debunkLead}</T>
      <Card style={{ gap: 6 }}>
        <VerdictBadge verdict={v.verdict as Verdict} />
        <T selectable>{replacement}</T>
      </Card>
      {readOnly && <Notice>{t.sheet.readOnly}</Notice>}
      {readOnly ? (
        <Button label={copied ? t.sheet.copied : t.sheet.copy} onPress={() => void copy(replacement).then(() => setCopied(true))} />
      ) : (
        <Button label={t.sheet.replace} onPress={() => close(replacement)} />
      )}
    </>
  );
}
