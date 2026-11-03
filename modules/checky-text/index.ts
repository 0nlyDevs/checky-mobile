import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

/** The Android side of the selection menu and of background checks (`android/`). Absent on iOS
 * and in Expo Go: every call is then a no-op that says so. */
type Native = {
  finish(text: string | null): Promise<void>;
  keepAlive(title: string, text: string): boolean;
  letGo(): void;
  moveToBack(): boolean;
  setShortcuts(entries: Shortcut[]): boolean;
  setWidget(json: string): boolean;
};

export type Shortcut = { id: string; label: string; target: "clipboard" | "scanner" | "enregistrer" };

const native = Platform.OS === "android" ? requireOptionalNativeModule<Native>("CheckyText") : null;

/** What Android handed to the `checky-sheet` component (initial props of ProcessTextActivity). */
export type SelectionRequest = { text?: string; readOnly?: boolean; action?: "check" | "translate" | "debunk" | "clipboard" };

/** Closes the selection sheet. A text replaces the selection when it is editable. */
export async function finishSelection(text: string | null = null): Promise<void> {
  await native?.finish(text);
}

/** Keeps the app running while a check goes on in the background. False when Android refused. */
export function keepAlive(title: string, text: string): boolean {
  try {
    return native?.keepAlive(title, text) ?? false;
  } catch {
    return false;
  }
}

export function letGo(): void {
  try {
    native?.letGo();
  } catch {
    // not running
  }
}

/** Back to the app the journalist came from, without closing Checky. */
export function moveToBack(): boolean {
  try {
    return native?.moveToBack() ?? false;
  } catch {
    return false;
  }
}

/** App-icon long-press shortcuts (« Vérifier le presse-papiers », « Scanner »). */
export function setShortcuts(entries: Shortcut[]): boolean {
  try {
    return native?.setShortcuts(entries) ?? false;
  } catch {
    return false;
  }
}

/** What the home-screen widget shows: the desk's latest signed verdicts. */
export function setWidget(data: { labels: { title: string; verify: string; empty: string }; rows: { id: string; verdict: string; word: string; title: string }[] }): void {
  try {
    native?.setWidget(JSON.stringify(data));
  } catch {
    // no widget on this phone
  }
}

