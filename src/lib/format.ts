import { tr } from "@/lib/i18n";

/** "3 h", "2 jours": how long something has been around. */
export function span(fromIso: string | undefined | null, now = Date.now()): string {
  if (!fromIso) return "";
  const t = tr();
  const minutes = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 60_000));
  if (minutes < 1) return t.time.now;
  if (minutes < 60) return t.time.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t.time.hours(hours);
  return t.time.days(Math.round(hours / 24));
}

export function ago(fromIso: string | undefined | null): string {
  const s = span(fromIso);
  const t = tr();
  return !s || s === t.time.now ? s : t.time.ago(s);
}

export function host(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** « 3 nov., 07:12 »: when an offline copy was taken (phone's local time, written out by hand:
 * Hermes' Intl is not on every phone). */
export function stamp(at: number | string | null | undefined): string {
  if (at === null || at === undefined) return "";
  // `2026-11-03T05:12Z` (a seal's minute) gets its seconds back for engines that want them.
  const d = new Date(typeof at === "string" ? at.replace(/T(\d\d:\d\d)Z$/, "T$1:00Z") : at);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${t.offline.months[d.getMonth()]}, ${hh}:${mm}`;
}

/** « 2 nov. 2026 » for a YYYY-MM-DD date, as printed on a communiqué. */
export function day(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${Number(m[3])} ${t.offline.months[Number(m[2]) - 1]} ${m[1]}` : (iso ?? "");
}
