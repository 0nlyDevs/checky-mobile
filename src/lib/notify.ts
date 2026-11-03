import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { tr } from "@/lib/i18n";

/** Local notifications only (« Vérification prête »): no push token, nothing leaves the phone. */
const CHANNEL = "checky-ready";
let channel: Promise<unknown> | null = null;

function ensureChannel() {
  if (Platform.OS !== "android") return Promise.resolve();
  channel ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: tr().background.channel,
    importance: AndroidImportance.DEFAULT,
  }).catch(() => null);
  return channel;
}

/** Asked when the journalist sends a check to the background (Android 13+ asks once). */
export async function askToNotify(): Promise<boolean> {
  try {
    await ensureChannel();
    const now = await Notifications.getPermissionsAsync();
    if (now.granted) return true;
    if (!now.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** What a tap on the notification opens: one check, or a batch of screenshots. */
export type Opens = { entry: string } | { batch: string };

export async function notifyReady(title: string, body: string, opens: Opens): Promise<void> {
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({ content: { title, body, data: opens }, trigger: Platform.OS === "android" ? { channelId: CHANNEL } : null });
  } catch {
    // no permission: the result waits in « À envoyer »
  }
}
