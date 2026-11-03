import { kv } from "@/lib/kv";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import type { Me, Membership } from "@/lib/types";

const KEY = "fanilo.workspace";

type Ctx = {
  me: Me | undefined;
  loading: boolean;
  error: unknown;
  current: Membership | null;
  choose: (id: string) => void;
  refresh: () => Promise<unknown>;
};

const WorkspaceContext = createContext<Ctx | null>(null);

/** The signed-in journalist and the newsroom the app works in (remembered on the phone). */
export function WorkspaceProvider({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  const { data: me, error, isLoading, mutate } = useSWR<Me>(signedIn ? "/me" : null, fetcher);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    kv.getItemAsync(KEY)
      .then(setChosen)
      .catch(() => null);
  }, []);

  const value = useMemo<Ctx>(() => {
    const list = me?.memberships ?? [];
    const current = list.find((m) => m.workspace_id === chosen) ?? list[0] ?? null;
    return {
      me,
      loading: isLoading,
      error,
      current,
      choose: (id) => {
        setChosen(id);
        kv.setItemAsync(KEY, id).catch(() => null);
      },
      refresh: () => mutate(),
    };
  }, [me, isLoading, error, chosen, mutate]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside WorkspaceProvider");
  return ctx;
}

/** The current newsroom's id; screens under the tabs only render once there is one. */
export function useWs(): string {
  const { current } = useWorkspace();
  if (!current) throw new Error("No workspace");
  return current.workspace_id;
}
