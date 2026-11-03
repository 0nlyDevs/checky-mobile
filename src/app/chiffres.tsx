import { useState } from "react";
import { FigureCard } from "@/components/figure-card";
import { matches, ReadingScreen } from "@/components/reading";
import { T } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { type Figure, keys, useStored } from "@/lib/offline";
import { useWs } from "@/lib/workspace";

/** « Chiffres », as kept on the phone: each official figure with its date, source and age. */
export default function Figures() {
  const t = useT();
  const ws = useWs();
  const kept = useStored<Figure[]>(keys.figures(ws));
  const [q, setQ] = useState("");
  const list = (kept?.data ?? []).filter((f) => matches(q, f.label, f.topic, f.source_name, f.keywords.join(" ")));
  return (
    <ReadingScreen title={t.figures.title} lead={t.figures.lead} at={kept?.at} desk query={q} onQuery={setQ}>
      {list.length ? list.map((f) => <FigureCard key={f.id} f={f} />) : <T tone="muted">{kept?.data.length ? t.offline.noMatch : t.offline.empty}</T>}
    </ReadingScreen>
  );
}
