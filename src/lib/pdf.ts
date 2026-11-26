// Rahisi Cash: tiny dependency-free PDF table writer.
// Produces a landscape A4 PDF with a title, a subtitle, a table whose header
// repeats on every page, and a footer with page numbers. Uses the built-in
// Helvetica fonts (WinAnsi), so French accents work. Characters outside that
// character set are shown as "?".

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 36;
const ROW_H = 17;
const FONT = 8;

// Helvetica widths (per 1000 units) for ASCII 32..126.
const W = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// Bold is about 8% wider on average; good enough to size columns safely.
const BOLD_FACTOR = 1.08;

const WINANSI_EXTRA: Record<string, number> = {
  "–": 0x96, "—": 0x97, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94,
  "•": 0x95, "…": 0x85, "€": 0x80,
};
const EXTRA_WIDTH: Record<number, number> = {
  0x96: 556, 0x97: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x85: 1000, 0x80: 556,
};

/** Text -> WinAnsi byte codes. Spaces of every kind become a plain space. */
function encode(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.normalize("NFC")) {
    const c = ch.codePointAt(0)!;
    if (c === 0x20 || c === 0xa0 || c === 0x202f || c === 0x2009 || c === 0x2007) out.push(0x20);
    else if (c > 0x20 && c < 0x7f) out.push(c);
    else if (c >= 0xa1 && c <= 0xff && c !== 0xad) out.push(c);
    else if (WINANSI_EXTRA[ch] !== undefined) out.push(WINANSI_EXTRA[ch]);
    else out.push(0x3f);
  }
  return out;
}

const BASE_LETTER = /[̀-ͯ]/g;
function byteWidth(b: number): number {
  if (b >= 32 && b < 127) return W[b - 32];
  if (EXTRA_WIDTH[b] !== undefined) return EXTRA_WIDTH[b];
  // Latin-1 accented letters are as wide as their base letter.
  const base = String.fromCharCode(b).normalize("NFD").replace(BASE_LETTER, "");
  const bc = base.charCodeAt(0);
  return bc >= 32 && bc < 127 ? W[bc - 32] : 556;
}

export function textWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (const b of encode(text)) w += byteWidth(b);
  return (w * size * (bold ? BOLD_FACTOR : 1)) / 1000;
}

/** Shorten with "..." until it fits in `max` points. */
export function fit(text: string, max: number, size: number, bold = false): string {
  if (textWidth(text, size, bold) <= max) return text;
  const chars = [...text.normalize("NFC")];
  while (chars.length > 1 && textWidth(chars.join("") + "...", size, bold) > max) chars.pop();
  return chars.join("").trimEnd() + "...";
}

const hex = (bytes: number[]) => "<" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("") + ">";
const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

export interface PdfTable {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  /** "r" right-aligns a column (money). Default "l". */
  align?: ("l" | "r")[];
  /** Footer, left side. */
  footerLeft?: string;
  /** Footer, right side, for page n of m. */
  pageLabel?: (n: number, m: number) => string;
}

/** Column widths: wide enough for the longest value, scaled down to fit the page. */
function columnWidths(t: PdfTable, avail: number): number[] {
  const pad = 10;
  const natural = t.headers.map((h, i) => {
    let m = textWidth(h, FONT, true);
    for (const r of t.rows) m = Math.max(m, textWidth(r[i] ?? "", FONT));
    return Math.min(m, 230) + pad;
  });
  const total = natural.reduce((a, b) => a + b, 0);
  if (total <= avail) {
    // spread the spare room evenly
    const extra = (avail - total) / natural.length;
    return natural.map((w) => w + extra);
  }
  const min = 38;
  const scale = avail / total;
  let widths = natural.map((w) => Math.max(min, w * scale));
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum > avail) widths = widths.map((w) => (w * avail) / sum);
  return widths;
}

export function buildPdf(t: PdfTable): Uint8Array {
  const avail = PAGE_W - 2 * MARGIN;
  const widths = columnWidths(t, avail);
  const align = t.headers.map((_, i) => t.align?.[i] ?? "l");

  const headerBlock = t.subtitle ? 62 : 46; // space used by title (+ subtitle) on page 1
  const bodyTop1 = PAGE_H - MARGIN - headerBlock;
  const bodyTopN = PAGE_H - MARGIN - 4;
  const bodyBottom = MARGIN + 22;
  const perPage = (top: number) => Math.max(1, Math.floor((top - bodyBottom) / ROW_H) - 1); // minus header row

  // split rows across pages
  const pages: string[][][] = [];
  let i = 0;
  let first = true;
  do {
    const cap = perPage(first ? bodyTop1 : bodyTopN);
    pages.push(t.rows.slice(i, i + cap));
    i += cap;
    first = false;
  } while (i < t.rows.length);

  const text = (x: number, y: number, s: string, size: number, bold: boolean, gray = 0): string =>
    `BT /${bold ? "F2" : "F1"} ${size} Tf ${gray} g ${n2(x)} ${n2(y)} Td ${hex(encode(s))} Tj ET\n`;

  const cellText = (s: string, colIdx: number, x: number, y: number, bold: boolean): string => {
    const w = widths[colIdx] - 10;
    const shown = fit(s, w, FONT, bold);
    const tx = align[colIdx] === "r" ? x + widths[colIdx] - 5 - textWidth(shown, FONT, bold) : x + 5;
    return text(tx, y, shown, FONT, bold);
  };

  const streams = pages.map((rows, p) => {
    let s = "";
    let top = bodyTopN;
    if (p === 0) {
      s += text(MARGIN, PAGE_H - MARGIN - 12, fit(t.title, avail, 15, true), 15, true);
      if (t.subtitle) s += text(MARGIN, PAGE_H - MARGIN - 30, fit(t.subtitle, avail, 9), 9, false, 0.4);
      top = bodyTop1;
    }
    // header row
    s += `0.92 0.95 0.93 rg ${n2(MARGIN)} ${n2(top - ROW_H)} ${n2(avail)} ${ROW_H} re f 0 g\n`;
    let x = MARGIN;
    t.headers.forEach((h, c) => { s += cellText(h, c, x, top - ROW_H + 5.5, true); x += widths[c]; });
    // body rows
    rows.forEach((r, ri) => {
      const yTop = top - ROW_H * (ri + 1);
      const yBase = yTop - ROW_H + 5.5;
      s += `0.85 G 0.4 w ${n2(MARGIN)} ${n2(yTop - ROW_H)} m ${n2(MARGIN + avail)} ${n2(yTop - ROW_H)} l S 0 G\n`;
      let cx = MARGIN;
      t.headers.forEach((_, c) => { s += cellText(r[c] ?? "", c, cx, yBase, false); cx += widths[c]; });
    });
    // footer
    if (t.footerLeft) s += text(MARGIN, MARGIN - 4, fit(t.footerLeft, avail / 2, 7), 7, false, 0.4);
    if (t.pageLabel) {
      const label = t.pageLabel(p + 1, pages.length);
      s += text(PAGE_W - MARGIN - textWidth(label, 7), MARGIN - 4, label, 7, false, 0.4);
    }
    return s;
  });

  // ---- assemble the file (everything is ASCII, so string length = byte length)
  const objs: string[] = [];
  const pageIds = pages.map((_, p) => 5 + p * 2);
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  streams.forEach((s, p) => {
    const pid = 5 + p * 2;
    objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pid + 1} 0 R >>`;
    objs[pid + 1] = `<< /Length ${s.length} >>\nstream\n${s}endstream`;
  });
  const titleUtf16 = [0xfe, 0xff, ...[...t.title].flatMap((ch) => {
    const c = ch.codePointAt(0)!;
    if (c > 0xffff) { const v = c - 0x10000; const hi = 0xd800 + (v >> 10), lo = 0xdc00 + (v & 0x3ff); return [hi >> 8, hi & 255, lo >> 8, lo & 255]; }
    return [c >> 8, c & 255];
  })];
  const infoId = objs.length;
  objs[infoId] = `<< /Title ${hex(titleUtf16)} /Producer (Rahisi Cash) >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 0xff;
  return bytes;
}
