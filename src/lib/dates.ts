import type { Lang } from "./types.ts";

// Rwanda has no daylight saving: always UTC+2. Every "day" in the app is a Kigali day.
const TZ = "Africa/Kigali";

/** Today in Kigali as "YYYY-MM-DD". */
export function kigaliToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function monthStart(day: string): string {
  return `${day.slice(0, 8)}01`;
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** UTC bounds covering the Kigali days from..to inclusive: created_at >= gte and < lt. */
export function rangeBounds(from: string, to: string): { gte: string; lt: string } {
  return {
    gte: new Date(`${from}T00:00:00+02:00`).toISOString(),
    lt: new Date(`${nextDay(to)}T00:00:00+02:00`).toISOString(),
  };
}

/** "4 Nov 2026" in English, "4 nov. 2026" in French, in Kigali time. */
export function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: TZ, day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

/** "2026-11" -> "November 2026" (English) or "novembre 2026" (French). */
export function formatMonth(month: string, lang: Lang): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "UTC", month: "long", year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, 15)));
}
