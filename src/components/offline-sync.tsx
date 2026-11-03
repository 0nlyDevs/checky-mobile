import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useSWRConfig } from "swr";

import { onReconnect } from "@/lib/network";
import { syncOffline } from "@/lib/offline";
import { useWorkspace } from "@/lib/workspace";

/** Starts a sync of the phone's offline sets for the current newsroom (or the public sets). */
export function useSyncNow(desk: boolean): (force: boolean) => void {
  const { mutate } = useSWRConfig();
  const { current } = useWorkspace();
  const ws = desk ? (current?.workspace_id ?? null) : null;
  const roomKey = desk && current ? `${current.slug}|${current.name}` : "";
  return useCallback(
    (force: boolean) => {
      const [slug, name] = roomKey.split("|");
      void syncOffline({
        ws,
        room: roomKey ? { slug, name } : null,
        prime: (key, data) => void mutate(key, data, { revalidate: false }),
        light: false,
        force,
      });
    },
    [ws, roomKey, mutate],
  );
}

/** Keeps the phone's offline sets fresh: on open, when the network comes back (both forced),
 * and when the app returns to the front (throttled). Renders nothing. */
export function OfflineSync({ desk }: { desk: boolean }) {
  const sync = useSyncNow(desk);
  useEffect(() => {
    sync(true);
    const off = onReconnect(() => sync(true));
    const app = AppState.addEventListener("change", (s) => s === "active" && sync(false));
    return () => {
      off();
      app.remove();
    };
  }, [sync]);
  return null;
}
