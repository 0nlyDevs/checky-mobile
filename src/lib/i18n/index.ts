import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

import { isLang, type Lang, langFromLocale, LOCALES, merge, type Messages } from "./core";
import { en } from "./en";
import { t as fr } from "./fr";
import { mg } from "./mg";

export { LANGS, NAMES, type Lang, type Messages } from "./core";

/**
 * The interface language. French is the source (`fr.ts`); `mg.ts` and `en.ts` override the keys they
 * know and French fills the rest. The choice is kept in SecureStore like the app's other preferences;
 * until one is made, the phone's language decides (Malagasy, French, otherwise English).
 */
const DICTS: Record<Lang, Messages> = { fr, mg: merge<Messages>(fr, mg), en: merge<Messages>(fr, en) };
const KEY = "fanilo.lang";

function deviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

let current: Lang = langFromLocale(deviceLocale());
let ready = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

// Read once, as early as possible: the root layout waits for it so the first screen is in the right language.
SecureStore.getItemAsync(KEY)
  .then((v) => {
    if (isLang(v)) current = v;
  })
  .catch(() => null)
  .finally(() => {
    ready = true;
    notify();
  });

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  SecureStore.setItemAsync(KEY, lang).catch(() => null);
  notify();
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, () => current);
}

/** True once the stored choice has been read. */
export function useLangReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready);
}

/** The strings in the chosen language, French where a translation is missing. Re-renders on a switch. */
export function useT(): Messages {
  return DICTS[useLang()];
}

/** The same strings outside a component (formatting helpers). Called while a component that uses
 * `useT()` renders, so it follows a switch too. */
export function tr(): Messages {
  return DICTS[current];
}

/** A date as people write it in the chosen language: « 3 novembre 2026 », « 3 November 2026 ». */
export function day(iso: string | null | undefined, lang: Lang = current): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleDateString(LOCALES[lang], { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
