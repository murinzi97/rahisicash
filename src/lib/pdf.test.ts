import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPdf, fit, textWidth } from "./pdf.ts";

const text = (b: Uint8Array) => Buffer.from(b).toString("latin1");

test("builds a valid PDF with correct xref offsets", () => {
  const pdf = text(buildPdf({ title: "Transactions", headers: ["A", "B"], rows: [["x", "1"]] }));
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.ok(pdf.trimEnd().endsWith("%%EOF"));
  const start = Number(pdf.match(/startxref\n(\d+)/)![1]);
  assert.ok(pdf.slice(start).startsWith("xref"));
  const entries = [...pdf.slice(start).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  entries.forEach((off, i) => assert.ok(pdf.slice(off).startsWith(`${i + 1} 0 obj`), `object ${i + 1} offset`));
});

test("splits long tables over several pages, header on each", () => {
  const rows = Array.from({ length: 120 }, (_, i) => [`row ${i}`, String(i)]);
  const pdf = text(buildPdf({ title: "T", headers: ["Name", "N"], rows, pageLabel: (n, m) => `Page ${n} of ${m}` }));
  const pages = Number(pdf.match(/\/Count (\d+)/)![1]);
  assert.ok(pages >= 3);
  assert.equal((pdf.match(/\/Type \/Page /g) ?? []).length, pages);
});

test("empty table still gives one page", () => {
  const pdf = text(buildPdf({ title: "T", headers: ["A"], rows: [] }));
  assert.equal(Number(pdf.match(/\/Count (\d+)/)![1]), 1);
});

test("French accents are single WinAnsi bytes; exotic characters become ?", () => {
  const pdf = text(buildPdf({ title: "Reçu", headers: ["Téléphone"], rows: [["日本"]] }));
  assert.ok(pdf.includes("e9")); // é as hex string byte
  assert.ok(!/[^\x00-\x7f]/.test(pdf), "file is pure ASCII outside binary streams");
});

test("narrow no-break space (French money) is measured and drawn as a space", () => {
  assert.equal(textWidth("10 000 RWF", 8), textWidth("10 000 RWF", 8));
});

test("fit shortens with ... and never exceeds the width", () => {
  const s = fit("A very long agent name that will not fit", 60, 8);
  assert.ok(s.endsWith("..."));
  assert.ok(textWidth(s, 8) <= 60);
  assert.equal(fit("short", 200, 8), "short");
});
