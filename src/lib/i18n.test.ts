import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { en } from "../i18n/en.ts";
import { fr } from "../i18n/fr.ts";

const E = en as Record<string, string>;
const F = fr as Record<string, string>;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("French has exactly the same keys as English, none empty", () => {
  assert.deepEqual(Object.keys(F).sort(), Object.keys(E).sort());
  for (const [k, v] of Object.entries(F)) assert.ok(v.trim(), `fr "${k}" is empty`);
});

test("French keeps every {placeholder} of the English text", () => {
  for (const k of Object.keys(E)) assert.equal(placeholders(F[k]), placeholders(E[k]), `placeholders differ in "${k}"`);
});

test("French typography: curly apostrophes, no line break before ? ! ; :", () => {
  for (const [k, v] of Object.entries(F)) {
    assert.ok(!v.includes("'"), `fr "${k}" has a straight apostrophe`);
    assert.ok(!/\S [?!;:](\s|$)/.test(v), `fr "${k}" has a breaking space before punctuation`);
  }
});

test("only words that are the same in both languages stay identical", () => {
  // names, cognates and the two language names (always shown in their own language)
  const allowed = new Set([
    "app.name", "admin.tab.agents", "agents.title", "agents.col.actions", "theme.auto", "kyc.selfie",
    "withdraw.clientPhonePlaceholder", "withdraw.lang.en", "withdraw.lang.fr", "pay.client", "report.commission",
    "common.total", "admin.col.date", "admin.col.agent", "admin.col.client", "admin.col.commission",
    "admin.col.transactions", "admin.payout.agent", "admin.payout.date", "admin.payout.transactions",
    "admin.payout.commission", "csv.commissionPct", "payout.method.momo",
  ]);
  const same = Object.keys(E).filter((k) => E[k] === F[k] && !allowed.has(k));
  assert.deepEqual(same, [], "these look untranslated");
});

test("agreed French terms", () => {
  assert.equal(F["withdraw.fee"], "Frais de transaction");
  assert.equal(F["admin.payout.confirm"], "Verser à l’agent");
});

/** Source files under src/, tests excluded. */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) sources(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

test("no visible English text hardcoded in pages or components", () => {
  const root = new URL("..", import.meta.url).pathname;
  const hits: string[] = [];
  for (const file of sources(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/wordmark/.test(line)) return; // the brand name RAHISI CASH is not translated
      const attr = line.match(/\b(aria-label|placeholder|title|alt)="([^"{]*[A-Za-z]{3,}[^"]*)"/);
      const text = line.match(/^\s*<(\w+)[^>]*>\s*([A-Za-z][^<>{}]*)\s*<\/\1>/);
      if (attr) hits.push(`${file.replace(root, "src/")}:${i + 1}: ${attr[0]}`);
      if (text) hits.push(`${file.replace(root, "src/")}:${i + 1}: ${text[2].trim()}`);
    });
  }
  assert.deepEqual(hits, []);
});
