import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { api } from "@/lib/api";
import { tr, useLang } from "@/lib/i18n";
import { setShortcuts, setWidget } from "../../modules/checky-text";
import { useWs } from "@/lib/workspace";
import type { ItemPage, Verdict } from "@/lib/types";

/** What the phone shows outside the app (Android): icon shortcuts and the home-screen widget. */
export function NativeSurfaces() {
  const ws = useWs();
  const lang = useLang();

  // Shortcuts, in the interface language. « Enregistrer la radio » is not offered: the phone has no
  // radio recording yet.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const t = tr();
    setShortcuts([
      { id: "clipboard", label: t.shortcuts.clipboard, target: "clipboard" },
      { id: "scanner", label: t.shortcuts.scanner, target: "scanner" },
    ]);
  }, [lang]);

  // The widget: the three latest verdicts a journalist signed, refreshed when Checky opens and leaves.
  useEffect(() => {
    if (Platform.OS !== "android" || !ws) return;
    let live = true;
    const push = async () => {
      const t = tr();
      const labels = { title: t.widget.title, verify: t.widget.verify, empty: t.widget.empty };
      try {
        const page = await api<ItemPage>(`/workspaces/${ws}/items?type=claim&limit=50`);
        if (!live) return;
        const rows = page.items
          .map((i) => ({ i, d: i.data as { verdict?: Verdict | null; ref?: string } }))
          .filter((x) => x.i.status === "published" && !!x.d.verdict)
          .slice(0, 3)
          .map(({ i, d }) => ({ id: i.id, verdict: d.verdict as string, word: t.verdict[d.verdict as string] ?? "", title: `${d.ref ? `${d.ref} · ` : ""}${i.title}` }));
        setWidget({ labels, rows });
      } catch {
        // Keep the last signed verdicts on the home screen when this phone is offline.
      }
    };
    void push();
    const sub = AppState.addEventListener("change", (s) => s !== "active" && void push());
    return () => {
      live = false;
      sub.remove();
    };
  }, [ws, lang]);

  return null;
}
