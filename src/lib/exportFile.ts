import { toCsv, type Cell } from "./csv.ts";
import { buildPdf } from "./pdf.ts";
import type { Lang } from "./types.ts";

export type ExportFormat = "csv" | "pdf";

export interface TableExport {
  format: ExportFormat;
  /** File name without extension. */
  filename: string;
  lang: Lang;
  title: string;
  subtitle?: string;
  /** CSV: plain numbers and ISO dates, so Excel opens them correctly. */
  csvHeaders: string[];
  csvRows: Cell[][];
  /** PDF: readable text, already formatted (dates, money, labels). */
  pdfHeaders: string[];
  pdfRows: string[][];
  pdfAlign?: ("l" | "r")[];
  footerLeft?: string;
  pageLabel?: (n: number, m: number) => string;
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTable(x: TableExport): void {
  if (x.format === "csv") {
    const csv = toCsv(x.csvHeaders, x.csvRows, x.lang);
    downloadBlob(`${x.filename}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
    return;
  }
  const pdf = buildPdf({
    title: x.title, subtitle: x.subtitle, headers: x.pdfHeaders, rows: x.pdfRows,
    align: x.pdfAlign, footerLeft: x.footerLeft, pageLabel: x.pageLabel,
  });
  downloadBlob(`${x.filename}.pdf`, new Blob([pdf as BlobPart], { type: "application/pdf" }));
}
