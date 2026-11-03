// The language logic with no React Native import, so it runs under `node --test`.
import type { t as fr } from "./fr";

export type Lang = "mg" | "fr" | "en";
/** In the order the picker shows them: Malagasy first, it is the country's language. */
export const LANGS: readonly Lang[] = ["mg", "fr", "en"];
/** For dates and numbers. */
export const LOCALES: Record<Lang, string> = { mg: "mg-MG", fr: "fr-FR", en: "en-GB" };
/** Each language named in itself, as the picker shows it. */
export const NAMES: Record<Lang, string> = { mg: "Malagasy", fr: "Français", en: "English" };

/** The French dictionary with every literal widened to `string`, so a translation can replace it. */
type Widen<T> = T extends (...args: infer A) => unknown
  ? (...args: A) => string
  : T extends string
    ? string
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;
export type Messages = Widen<typeof fr>;
type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;
/** What a translation file may hold: any subset of the French keys (an unknown key fails tsc). */
export type Overrides = DeepPartial<Messages>;

const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** French with the translation laid over it: a key the translation lacks stays French. */
export function merge<T>(base: T, over: unknown): T {
  if (!plain(base) || !plain(over)) return (over ?? base) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue;
    out[key] = plain(base[key]) && plain(value) ? merge(base[key], value) : value;
  }
  return out as T;
}

export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as readonly string[]).includes(v);

/** The phone's language as a starting point: Malagasy → Malagasy, French → French, anything else → English. */
export function langFromLocale(locale: string | null | undefined): Lang {
  const base = (locale ?? "").split(/[-_]/)[0].toLowerCase();
  if (base === "mg" || base === "plt") return "mg";
  if (base === "fr") return "fr";
  return "en";
}

/** Every leaf path of a dictionary (« citizen.by », « verdict.false »…). */
export function leaves(dict: unknown, prefix = ""): string[] {
  if (!plain(dict)) return [prefix];
  return Object.entries(dict).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

/** The first sentence of a text, for a line read on air. */
export function firstSentence(text: string | null | undefined, max = 220): string {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const end = s.search(/[.!?…](\s|$)/);
  const one = end >= 0 ? s.slice(0, end + 1) : s;
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : /[.!?…]$/.test(one) ? one : `${one}.`;
}
