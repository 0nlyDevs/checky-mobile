import { getShareExtensionKey } from "expo-share-intent";

// iOS hands shared content over through a deep link; the root layout's ShareForwarder takes it from there.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return path.includes(`dataUrl=${getShareExtensionKey()}`) ? "/" : path;
  } catch {
    return "/";
  }
}
