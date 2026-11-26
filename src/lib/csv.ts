import type { Lang } from "./types.ts";

export type Cell = string | number | null | undefined;

/**
 * Text that a spreadsheet could read as a formula is prefixed with an apostrophe.
 * "+250..." style masked phone numbers and negative numbers are left alone.
 */
function guard(s: string): string {
  if (/^[=@\t\r]/.test(s)) return `'${s}`;
  if (/^[+-]/.test(s) && !/^[+-][\d\s*.]+$/.test(s)) return `'${s}`;
  return s;
}

export function csvCell(v: Cell, delimiter: string): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : guard(v);
  if (s.includes('"') || s.includes(delimiter) || /[\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** French Excel expects ";" between columns, English Excel ",". A BOM keeps accents intact. */
export function csvDelimiter(lang: Lang): string {
  return lang === "fr" ? ";" : ",";
}

export function toCsv(headers: string[], rows: Cell[][], lang: Lang): string {
  const d = csvDelimiter(lang);
  const lines = [headers, ...rows].map((r) => r.map((c) => csvCell(c, d)).join(d));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/** ISO 8601 (UTC) for a database timestamp, or "" when empty. */
export function isoDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
