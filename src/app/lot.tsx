import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { OfflineNotice } from "@/components/outbox";
import { Button, Card, Notice, Screen, Section, T, VerdictBadge, styles } from "@/components/ui";
import { groupByRumour, MAX_BATCH } from "@/lib/group";
import { handOff } from "@/lib/handoff";
import { tr, useT } from "@/lib/i18n";
import { ArrowLeft } from "@/lib/icons";
import { type Entry, useBatch, useOutbox } from "@/lib/outbox";
import { fonts, radius, useTheme } from "@/lib/theme";
import { moveToBack } from "../../modules/checky-text";

function stateWord(e: Entry, share: number | undefined): string {
  const t = tr();
  if (e.state === "done") return t.batch.state.done;
  if (e.state === "failed") return t.batch.state.failed;
  if (e.state === "waiting") return t.batch.state.waiting;
  if (!e.sourceId) return share !== undefined ? `${t.batch.state.upload} ${t.check.percent(share)}` : t.batch.state.upload;
  return e.sha256 === undefined ? t.batch.state.read : t.batch.state.check;
}

/** « Plusieurs captures d'un coup »: screenshots shared together, each uploaded and checked by
 * the outbox (so it goes on in the background and offline), then grouped by rumour. */
export default function Batch() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const { batch, more } = useLocalSearchParams<{ batch?: string; more?: string }>();
  const entries = useBatch(batch);
  const { progress } = useOutbox();
  const groups = useMemo(
    () =>
      groupByRumour(
        entries.map((e) => ({
          sha256: e.sha256,
          dhash: e.dhash,
          trackedId: e.result?.tracked?.item_id,
          text: e.result?.claims?.[0] ?? (e.result?.excerpt || null),
        })),
      ),
    [entries],
  );
  const done = entries.filter((e) => e.state === "done" || e.state === "failed").length;
  const busy = done < entries.length;

  return (
    <Screen>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="title" style={{ flex: 1 }}>
          {t.batch.title}
        </T>
      </View>
      <OfflineNotice />
      {!entries.length ? (
        <Notice>{t.analyse.empty}</Notice>
      ) : (
        <>
          <T tone="muted">{t.batch.lead(entries.length)}</T>
          {more === "1" && <Notice>{t.batch.tooMany(MAX_BATCH)}</Notice>}
          <T tone="tabular">{t.batch.progress(done, entries.length)}</T>
          {busy && (
            <View style={{ gap: 6 }}>
              <Button label={t.background.go} variant="outline" onPress={() => moveToBack()} />
              <T tone="muted">{t.background.hint}</T>
            </View>
          )}
        </>
      )}

      {groups.map((g, i) => (
        <Section key={g.members.join("-")} title={g.members.length > 1 ? t.batch.group(i + 1, g.members.length) : t.batch.single} note={g.links.map((l) => t.batch.links[l]).join(" · ") || undefined}>
          {g.members.map((m) => {
            const e = entries[m];
            const a = e.result?.analysis;
            return (
              <Card key={e.id} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                {!!e.check?.file && <Image source={{ uri: e.check.file.uri }} contentFit="cover" style={{ width: 64, height: 96, borderRadius: radius.tag }} accessibilityIgnoresInvertColors />}
                <View style={{ flex: 1, gap: 6 }}>
                  <T tone="label">{stateWord(e, progress[e.id])}</T>
                  {e.result?.tracked && <T>{t.check.tracked(e.result.tracked.ref ?? e.result.tracked.title)}</T>}
                  {!!e.result?.claims?.[0] && (
                    <T style={{ fontFamily: fonts.semibold }} numberOfLines={3}>
                      {e.result.claims[0]}
                    </T>
                  )}
                  {a && <VerdictBadge verdict={a.verdict} suggested />}
                  {e.state === "done" && !e.result?.claims?.length && !e.result?.excerpt && <T tone="muted">{t.batch.noText}</T>}
                  {e.state === "failed" && <T tone="muted">{t.outbox.errors[e.error ?? "failed"] ?? t.outbox.errors.failed}</T>}
                  {e.state === "done" && <Button label={t.batch.open} variant="outline" onPress={() => router.push({ pathname: "/analyze", params: { id: handOff({ queued: e.id }) } })} />}
                </View>
              </Card>
            );
          })}
        </Section>
      ))}
    </Screen>
  );
}
