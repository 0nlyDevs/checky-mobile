import { useState } from "react";
import { Linking, View } from "react-native";

import { fold, matches, ReadingScreen } from "@/components/reading";
import { Button, Card, T, styles } from "@/components/ui";
import { openWeb } from "@/lib/handoff";
import { t } from "@/lib/i18n/fr";
import { Envelope, Globe, Phone, SealCheck } from "@/lib/icons";
import { type Contact, keys, useStored } from "@/lib/offline";
import { fonts, useTheme } from "@/lib/theme";
import { useWs } from "@/lib/workspace";

/** « Annuaire », as kept on the phone: who to call, with the official numbers. */
export default function Directory() {
  const ws = useWs();
  const kept = useStored<Contact[]>(keys.contacts(ws));
  const [q, setQ] = useState("");
  const list = (kept?.data ?? [])
    .filter((x) => matches(q, x.name, x.role, x.institution, x.topics.join(" "), String(x.location?.region ?? "")))
    .sort((a, b) => fold(a.institution || a.name).localeCompare(fold(b.institution || b.name)));
  return (
    <ReadingScreen title={t.directory.title} lead={t.directory.lead} at={kept?.at} desk query={q} onQuery={setQ}>
      {list.length ? list.map((x) => <ContactCard key={x.id} x={x} />) : <T tone="muted">{kept?.data.length ? t.offline.noMatch : t.offline.empty}</T>}
    </ReadingScreen>
  );
}

function ContactCard({ x }: { x: Contact }) {
  const c = useTheme();
  const region = typeof x.location?.region === "string" ? x.location.region : null;
  return (
    <Card style={{ gap: 6 }}>
      <View style={styles.row}>
        <T style={{ fontFamily: fonts.semibold, flex: 1 }}>{x.name}</T>
        {x.verified_at && (
          <View style={styles.row}>
            <SealCheck size={15} color={c.foreground} />
            <T style={{ fontSize: 14 }}>{t.directory.verified}</T>
          </View>
        )}
      </View>
      <T tone="muted">{[x.role, x.institution, region, x.is_demo ? t.offline.demo : ""].filter(Boolean).join(" · ")}</T>
      {x.topics.length > 0 && <T style={{ fontSize: 14 }}>{x.topics.join(", ")}</T>}
      <View style={styles.wrap}>
        {x.phone && <Button label={x.phone} icon={Phone} variant="outline" onPress={() => void Linking.openURL(`tel:${x.phone!.replace(/[^\d+]/g, "")}`)} />}
        {x.email && <Button label={t.directory.email} icon={Envelope} variant="outline" onPress={() => void Linking.openURL(`mailto:${x.email}`)} />}
        {x.website && <Button label={t.directory.site} icon={Globe} variant="ghost" onPress={() => openWeb(x.website)} />}
      </View>
    </Card>
  );
}
