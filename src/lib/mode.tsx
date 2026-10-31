import * as SecureStore from "expo-secure-store";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type Mode = "citizen" | "journalist";
const KEY = "fanilo.mode";

type Ctx = { mode: Mode | null; loaded: boolean; setMode: (m: Mode) => void };
const ModeContext = createContext<Ctx | null>(null);

/** Who uses the app on this phone: a citizen (no account) or a journalist (the desk). */
export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, set] = useState<Mode | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => set(v === "citizen" || v === "journalist" ? v : null))
      .catch(() => null)
      .finally(() => setLoaded(true));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      mode,
      loaded,
      setMode: (m) => {
        set(m);
        SecureStore.setItemAsync(KEY, m).catch(() => null);
      },
    }),
    [mode, loaded],
  );
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): Ctx {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode outside ModeProvider");
  return ctx;
}
