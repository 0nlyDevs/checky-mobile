import { useRouter } from "expo-router";
import { Pressable, RefreshControl, View } from "react-native";

import { AgeLine } from "@/components/age-line";
import { ClaimRow } from "@/components/claim-row";
import { ContentRail } from "@/components/content-rail";
import { FigureCard } from "@/components/figure-card";
import { OfflineLinks } from "@/components/offline-links";
import { useSyncNow } from "@/components/offline-sync";
import { useTabInset } from "@/components/tab-bar";
import { Button, Card, Screen, Section, T, styles } from "@/components/ui";
import { ago } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AddressBook, Checks, Phone, Scan } from "@/lib/icons";
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
      {!r && <T tone="muted">{sync.running ? t.common.loading : t.rubrique.nothing}</T>}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button label={t.citizen.check} icon={Scan} style={{ flex: 1 }} onPress={() => router.navigate("/")} />
        <Button label={t.directory.title} icon={AddressBook} variant="outline" style={{ flex: 1 }} onPress={() => router.push("/annuaire")} />
      </View>
      {r && r.to_sign.length > 0 && <Card style={{ backgroundColor: c.primary, borderColor: c.primary, padding: 22 }}><T style={{ color: c.primaryForeground, fontFamily: fonts.medium, fontSize: 13 }}>{t.navigation.attention}</T><T style={{ color: c.primaryForeground, fontFamily: fonts.display, fontSize: 29, lineHeight: 35 }}>{r.to_sign.length} · {t.rubrique.toSign}</T><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/affirmation/[id]", params: { id: r.to_sign[0].id } })} style={{ minHeight: 44, justifyContent: "center" }}><T style={{ color: c.primaryForeground, fontFamily: fonts.semibold, textDecorationLine: "underline" }}>{t.navigation.resume}</T></Pressable></Card>}
      {r && <ContentRail title={t.rubrique.toSign} items={r.to_sign} itemKey={i => i.id} renderItem={i => <ClaimRow item={i} compact />} />}
      {r && <ContentRail title={t.rubrique.mine} items={r.mine.filter(i => !r.to_sign.some(s => s.id === i.id))} itemKey={i => i.id} renderItem={i => <ClaimRow item={i} compact />} onSeeAll={() => router.navigate("/affirmations")} />}

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
        <ContentRail title={t.rubrique.contacts} items={r.contacts} itemKey={x => x.id} onSeeAll={() => router.push("/annuaire")} renderItem={x => (
            <Card style={{ gap: 10, padding: 20, minHeight: 180 }}>
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
          )} />
      )}

      {r && <ContentRail title={t.rubrique.figures} items={r.figures} itemKey={f => f.id} renderItem={f => <FigureCard f={f} />} onSeeAll={() => router.push("/chiffres")} />}

      {r && r.angles.length > 0 && (
        <ContentRail title={t.rubrique.angles} items={r.angles} itemKey={a => `${a.title}-${a.kind}`} renderItem={a => (
            // A suggestion: dashed until a journalist keeps it.
            <View style={{ gap: 12, padding: 20, minHeight: 200, borderRadius: radius.card, borderWidth: 2, borderStyle: "dashed", borderColor: c.input }}>
              <T style={{ fontFamily: fonts.semibold }}>{a.title}</T>
              <T tone="muted">{a.why}</T>
            </View>
          )} />
      )}

      {r && !r.to_sign.length && !r.mine.length && !r.circulating.length && <T tone="muted">{t.rubrique.nothing}</T>}

      <Section title={t.rubrique.more}>
        <OfflineLinks desk />
      </Section>
    </Screen>
  );
}
