import { t } from "@/lib/i18n/fr";

/** "3 h", "2 jours": how long something has been around. */
export function span(fromIso: string | undefined | null, now = Date.now()): string {
  if (!fromIso) return "";
  const minutes = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 60_000));
  if (minutes < 1) return t.time.now;
  if (minutes < 60) return t.time.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t.time.hours(hours);
  return t.time.days(Math.round(hours / 24));
}

export function ago(fromIso: string | undefined | null): string {
  const s = span(fromIso);
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
