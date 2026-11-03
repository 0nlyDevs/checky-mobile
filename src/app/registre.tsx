import { useState } from "react";
import { Pressable, View } from "react-native";

import { matches, ReadingScreen } from "@/components/reading";
import { Card, T, styles } from "@/components/ui";
import { day } from "@/lib/format";
import { t } from "@/lib/i18n/fr";
import { Checks, Stamp, WarningOctagon } from "@/lib/icons";
import { keys, type RegistryRow, useStored } from "@/lib/offline";
import { fonts, useTheme } from "@/lib/theme";
import { useWorkspace } from "@/lib/workspace";

/** « Registre », as kept on the phone: the originals of the last 90 days, text only, searched
 * by issuer, number or words with no network (brief 6.3). */
export default function Registry() {
  const ws = useWorkspace().current?.workspace_id ?? null;
  const kept = useStored<RegistryRow[]>(ws ? keys.registry(ws) : keys.publicRegistry);
  const [q, setQ] = useState("");
  const seen = new Set<string>();
  const list = (kept?.data ?? []).filter((r) => !seen.has(r.id) && seen.add(r.id) && matches(q, r.issuer, r.number, r.title, r.text, r.issued_on));
  return (
    <ReadingScreen title={t.registry.title} lead={t.registry.lead} at={kept?.at} desk={!!ws} query={q} onQuery={setQ}>
      {list.length ? list.map((r) => <Row key={r.id} r={r} />) : <T tone="muted">{kept?.data.length ? t.offline.noMatch : t.offline.empty}</T>}
    </ReadingScreen>
  );
}

function Row({ r }: { r: RegistryRow }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const fake = r.kind === "fake_caught";
  const Icon = fake ? WarningOctagon : Stamp;
  return (
    <Card style={{ gap: 6 }}>
      <View style={styles.row}>
        <Icon size={16} color={c.foreground} />
        <T tone="label" style={{ flex: 1 }}>
          {[t.registry.kind[r.kind], r.sealedQr ? t.registry.sealed : "", r.is_demo ? t.offline.demo : ""].filter(Boolean).join(" · ")}
        </T>
      </View>
      <T tone="muted">{[r.issuer, r.number, day(r.issued_on)].filter(Boolean).join(" · ")}</T>
      <T style={{ fontFamily: fonts.semibold }}>{r.title}</T>
      {r.confirmed && (
        <View style={styles.row}>
          <Checks size={15} color={c.foreground} />
          <T style={{ fontSize: 14 }}>{t.registry.confirmed}</T>
        </View>
      )}
      {open && <T selectable>{r.text}</T>}
      <Pressable accessibilityRole="button" onPress={() => setOpen((o) => !o)} hitSlop={8}>
        <T style={{ textDecorationLine: "underline", fontSize: 15 }}>{open ? t.registry.hideText : t.registry.showText}</T>
      </Pressable>
    </Card>
  );
}
