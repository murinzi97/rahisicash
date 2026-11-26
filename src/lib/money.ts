import type { Lang } from "./types.ts";

const NARROW_NBSP = "\u202f";

/** English: "RWF 10,000".  French: "10 000 RWF" (narrow no-break spaces). */
export function formatRwf(amount: number, lang: Lang): string {
  if (!Number.isFinite(amount)) return "";
  const negative = amount < 0;
  const digits = String(Math.abs(Math.round(amount)));
  const sep = lang === "fr" ? NARROW_NBSP : ",";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const sign = negative ? "-" : "";
  return lang === "fr"
    ? `${sign}${grouped}${NARROW_NBSP}RWF`
    : `${sign}RWF ${grouped}`;
}

/** Digits only, grouped for display while typing: "10000" -> "10,000" (English) or "10 000" (French). */
export function groupDigits(digits: string, lang: Lang): string {
  const clean = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, lang === "fr" ? NARROW_NBSP : ",");
}
