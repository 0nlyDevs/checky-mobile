import { router } from "expo-router";

/** Back, or home when there is no screen to go back to (a screen opened from a share, a deep
 * link or after Android recreated the app): a back arrow must never do nothing. */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
