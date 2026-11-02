import * as Network from "expo-network";

/** Unknown counts as online: a failed request is what really tells us, and the outbox retries anyway. */
function reachable(s: Network.NetworkState): boolean {
  return s.isConnected !== false && s.isInternetReachable !== false;
}

export function useOnline(): boolean {
  return reachable(Network.useNetworkState());
}

export async function isOnline(): Promise<boolean> {
  try {
    return reachable(await Network.getNetworkStateAsync());
  } catch {
    return true;
  }
}

/** Calls back each time the phone gets a connection back (SWR revalidation, outbox flush). */
export function onReconnect(callback: () => void): () => void {
  let was = true;
  const sub = Network.addNetworkStateListener((s) => {
    const now = reachable(s);
    if (now && !was) callback();
    was = now;
  });
  return () => sub.remove();
}

/** A request that failed for want of a network, not because the server said no. */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (e instanceof Error && /network|fetch|timed? ?out|abort/i.test(e.message));
}
