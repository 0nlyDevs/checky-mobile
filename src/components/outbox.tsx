import { useRouter } from "expo-router";
import { Checks, Clock, CloudArrowUp, CloudSlash, type Icon, WarningOctagon } from "@/lib/icons";
import { Pressable, View } from "react-native";

import { Button, Card, Notice, Section, T } from "@/components/ui";
import { host } from "@/lib/format";
import { handOff } from "@/lib/handoff";
import { tr, useT } from "@/lib/i18n";
import { useOnline } from "@/lib/network";
import { type Entry, useOutbox } from "@/lib/outbox";
import { fonts, useTheme } from "@/lib/theme";

/** Shown at the top of the desk screens while the phone has no network. */
export function OfflineNotice({ stale }: { stale?: boolean }) {
  const t = useT();
  const online = useOnline();
  const { entries } = useOutbox();
  const pending = entries.filter((e) => e.state === "waiting" || e.state === "sending").length;
  if (online) return null;
  return (
    <View accessibilityRole="alert" style={{ gap: 6 }}>
      <Notice>{stale ? t.outbox.stale : t.outbox.offline}</Notice>
      {pending > 0 && <T tone="muted">{t.outbox.pending(pending)}</T>}
    </View>
  );
}

function label(e: Entry): { kind: string; title: string } {
  const t = tr();
  if (e.kind === "claim") return { kind: t.outbox.kind.claim, title: e.claim?.title ?? "" };
  const c = e.check ?? {};
  if (c.file) return { kind: t.outbox.kind[c.file.mime.split("/")[0]] ?? t.outbox.kind.application, title: c.file.name };
  if (c.url) return { kind: t.outbox.kind.link, title: host(c.url) || c.url };
  return { kind: t.outbox.kind.text, title: c.text ?? "" };
}

/** Status words with ink icons: being queued says nothing about whether a claim is true. */
function stateOf(e: Entry, online: boolean): { Icon: Icon; word: string } {
  const t = tr();
  if (e.state === "done") return { Icon: Checks, word: e.kind === "claim" ? t.outbox.state.created : t.outbox.state.done };
  if (e.state === "failed") return { Icon: WarningOctagon, word: `${t.outbox.state.failed} · ${t.outbox.errors[e.error ?? "failed"] ?? t.outbox.errors.failed}` };
  if (e.state === "sending") return { Icon: CloudArrowUp, word: t.outbox.state.sending };
  return online ? { Icon: Clock, word: t.outbox.state.waiting } : { Icon: CloudSlash, word: t.outbox.state.offline };
}

/** "À envoyer": what was captured offline, and what came back once sent. */
export function OutboxList({ kind }: { kind?: Entry["kind"] }) {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const online = useOnline();
  const { entries, progress, remove, retry } = useOutbox();
  const list = kind ? entries.filter((e) => e.kind === kind) : entries;
  if (!list.length) return null;

  function open(e: Entry) {
    if (e.kind === "claim" && e.itemId) {
      remove(e.id);
      router.push({ pathname: "/affirmation/[id]", params: { id: e.itemId } });
    } else if (e.kind === "check") {
      router.push({ pathname: "/analyse", params: { id: handOff({ queued: e.id }) } });
    }
  }

  return (
    <Section title={t.outbox.title}>
      {list.map((e) => {
        const { kind: k, title } = label(e);
        const { Icon, word } = stateOf(e, online);
        const share = progress[e.id];
        const done = e.state === "done";
        return (
          <Card key={e.id} style={{ gap: 8 }}>
            <Pressable accessibilityRole={done ? "button" : undefined} disabled={!done} onPress={() => open(e)} style={{ gap: 4 }}>
              <T tone="label">{k}</T>
              <T style={{ fontFamily: fonts.semibold }} numberOfLines={2}>
                {title}
              </T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon size={15} color={c.foreground} />
                <T style={{ fontSize: 14, fontFamily: fonts.medium, flex: 1 }}>
                  {word}
                  {e.state === "sending" && share !== undefined ? ` ${t.check.percent(share)}` : ""}
                </T>
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {done && <Button label={t.common.open} onPress={() => open(e)} style={{ flex: 1 }} />}
              {e.state === "failed" && <Button label={t.common.retry} variant="outline" onPress={() => retry(e.id)} style={{ flex: 1 }} />}
              {e.state !== "sending" && <Button label={t.outbox.remove} variant="ghost" onPress={() => remove(e.id)} style={{ flex: 1 }} />}
            </View>
          </Card>
        );
      })}
    </Section>
  );
}
