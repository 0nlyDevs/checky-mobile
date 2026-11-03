import { kv } from "@/lib/kv";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

/** « Mode léger » (brief 0.9, 6.3), for satellite and 2G links: text first, images and videos
 * only when tapped, slower polling, photos compressed before upload. Chosen in Réglages (or from
 * the slow-network suggestion) and kept on the phone. */
const KEY = "fanilo.light";

// Read outside React too (upload, polling loops).
let current = false;
export const isLight = () => current;

/** A polling interval, three times slower in Mode léger. */
export const pace = (ms: number) => (current ? ms * 3 : ms);

type Ctx = { light: boolean; setLight: (on: boolean) => void; dismissed: boolean; dismiss: () => void };
const LightContext = createContext<Ctx | null>(null);

export function LightProvider({ children }: { children: ReactNode }) {
  const [light, set] = useState(false);
  // The suggestion, once declined, stays away until the app is opened again.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    kv.getItemAsync(KEY)
      .then((v) => {
        current = v === "1";
        set(current);
      })
      .catch(() => null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      light,
      setLight: (on) => {
        current = on;
        set(on);
        kv.setItemAsync(KEY, on ? "1" : "0").catch(() => null);
      },
      dismissed,
      dismiss: () => setDismissed(true),
    }),
    [light, dismissed],
  );
  return <LightContext.Provider value={value}>{children}</LightContext.Provider>;
}

export function useLight(): Ctx {
  const ctx = useContext(LightContext);
  if (!ctx) throw new Error("useLight outside LightProvider");
  return ctx;
}
