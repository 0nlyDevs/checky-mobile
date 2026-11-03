import { useRouter } from "expo-router";
import { Pressable, RefreshControl, View } from "react-native";

import { AgeLine } from "@/components/age-line";
import { ClaimRow } from "@/components/claim-row";
import { FigureCard } from "@/components/figure-card";
import { OfflineLinks } from "@/components/offline-links";
import { useSyncNow } from "@/components/offline-sync";
import { useTabInset } from "@/components/tab-bar";
import { Card, Screen, Section, T, styles } from "@/components/ui";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Checks, Phone } from "@/lib/icons";
import { keys, type Rubrique, useStored, useSyncState } from "@/lib/offline";
import { fonts, radius, useTheme } from "@/lib/theme";
import { useWs } from "@/lib/workspace";

/** « Ma rubrique »: the journalist's beat this morning, read from the copy kept on the phone, so
 * it opens the same with no network (brief 0.1, 0.9). Beats and region are chosen on the desk. */
export default function MyBeat() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const inset = useTabInset();
  const ws = useWs();
  const kept = useStored<Rubrique>(keys.rubrique(ws));
  const sync = useSyncState();
  const syncNow = useSyncNow(true);
  const r = kept?.data;
  const scope = r ? [...r.beats, ...r.regions].join(" · ") : "";

  return (
    <Screen bottomInset={inset} refreshControl={<RefreshControl refreshing={sync.running} onRefresh={() => syncNow(true)} />}>
      <View style={{ gap: 6 }}>
        <T tone="title">{t.rubrique.title}</T>
        <T tone="muted">{[r?.today_label, scope].filter(Boolean).join(" · ") || t.rubrique.prefs}</T>
        <AgeLine at={kept?.at} />
      </View>

      {r && (r.to_sign.length > 0 ? <Section title={t.rubrique.toSign}>{r.to_sign.map((i) => <ClaimRow key={i.id} item={i} />)}</Section> : null)}
      {r && r.mine.length > 0 && <Section title={t.rubrique.mine}>{r.mine.map((i) => <ClaimRow key={i.id} item={i} />)}</Section>}

      {r && r.circulating.length > 0 && (
        <Section title={t.rubrique.circulating}>
          {r.circulating.map((x) => (
            <Pressable
              key={`${x.kind}-${x.id}`}
              accessibilityRole={x.item_id ? "button" : undefined}
              disabled={!x.item_id}
              onPress={() => x.item_id && router.push({ pathname: "/affirmation/[id]", params: { id: x.item_id } })}
            >
              <Card style={{ gap: 4 }}>
                <T tone="label">{[t.rubrique.kind[x.kind] ?? x.kind, x.station, ago(x.at), x.demo ? t.offline.demo : ""].filter(Boolean).join(" · ")}</T>
                <T style={{ fontFamily: fonts.semibold }}>{x.title}</T>
                {x.already_checked && (
                  <View style={styles.row}>
                    <Checks size={15} color={c.foreground} />
                    <T style={{ fontSize: 14, fontFamily: fonts.medium }}>{t.rubrique.already}</T>
                  </View>
                )}
              </Card>
            </Pressable>
          ))}
        </Section>
      )}

      {r && r.contacts.length > 0 && (
        <Section title={t.rubrique.contacts}>
          {r.contacts.map((x) => (
            <Card key={x.id} style={{ gap: 4 }}>
              <T style={{ fontFamily: fonts.semibold }}>{x.name}</T>
              <T tone="muted">{[x.role, x.institution, x.region, x.is_demo ? t.offline.demo : ""].filter(Boolean).join(" · ")}</T>
              {x.phone && (
                <View style={styles.row}>
                  <Phone size={15} color={c.foreground} />
                  <T tone="tabular" selectable>
                    {x.phone}
                  </T>
                </View>
              )}
            </Card>
          ))}
        </Section>
      )}

      {r && r.figures.length > 0 && <Section title={t.rubrique.figures}>{r.figures.map((f) => <FigureCard key={f.id} f={f} />)}</Section>}

      {r && r.angles.length > 0 && (
        <Section title={t.rubrique.angles} note={t.rubrique.anglesNote}>
          {r.angles.map((a, i) => (
            // A suggestion: dashed until a journalist keeps it.
            <View key={`${a.title}-${i}`} style={{ gap: 4, padding: 14, borderRadius: radius.card, borderWidth: 2, borderStyle: "dashed", borderColor: c.border }}>
              <T style={{ fontFamily: fonts.semibold }}>{a.title}</T>
              <T tone="muted">{a.why}</T>
            </View>
          ))}
        </Section>
      )}

      {r && !r.to_sign.length && !r.mine.length && !r.circulating.length && <T tone="muted">{t.rubrique.nothing}</T>}

      <Section title={t.rubrique.more}>
        <OfflineLinks desk />
      </Section>
    </Screen>
  );
}
