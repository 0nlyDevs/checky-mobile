import { useState } from "react";

import { PublicVerdictRow } from "@/components/public-verdict-row";
import { matches, ReadingScreen } from "@/components/reading";
import { T } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { keys, useStored } from "@/lib/offline";
import type { PublicVerdict } from "@/lib/public";
import { useWorkspace } from "@/lib/workspace";

/** The published verdicts kept on the phone, readable with no network. */
export default function Verdicts() {
  const t = useT();
  const desk = !!useWorkspace().current;
  const kept = useStored<PublicVerdict[]>(keys.verdicts);
  const [q, setQ] = useState("");
  const list = (kept?.data ?? []).filter((v) => matches(q, v.title, v.reason, v.ref, v.newsroom.name));
  return (
    <ReadingScreen title={t.verdictsOffline.title} lead={t.verdictsOffline.lead} at={kept?.at} desk={desk} query={q} onQuery={setQ}>
      {list.length ? list.map((v) => <PublicVerdictRow key={v.id} v={v} />) : <T tone="muted">{kept?.data.length ? t.offline.noMatch : t.offline.empty}</T>}
    </ReadingScreen>
  );
}
