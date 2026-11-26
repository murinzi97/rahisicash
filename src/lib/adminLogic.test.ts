import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv, isoDate } from "./csv.ts";
import { parsePercent } from "./adminFees.ts";
import { byMonth, sumRevenue, type DayRevenue } from "./revenue.ts";
import { searchFilter } from "./adminQuery.ts";
import { calculateFees } from "./fees.ts";

test("csv: plain numbers, quoting and formula guard", () => {
  assert.equal(csvCell(10300, ","), "10300");
  assert.equal(csvCell(-5, ","), "-5");
  assert.equal(csvCell(null, ","), "");
  assert.equal(csvCell('a "b", c', ","), '"a ""b"", c"');
  assert.equal(csvCell("=1+1", ","), "'=1+1");
  assert.equal(csvCell("0788 *** 456", ","), "0788 *** 456");
  assert.equal(csvCell("+254 *** 678", ","), "+254 *** 678");
  assert.equal(csvCell("-cmd", ","), "'-cmd");
  assert.equal(csvCell("a;b", ";"), '"a;b"');
});

test("csv: BOM, delimiter by language, CRLF", () => {
  assert.equal(toCsv(["a", "b"], [[1, "x"]], "en"), "\uFEFFa,b\r\n1,x\r\n");
  assert.equal(toCsv(["a", "b"], [[1, "x"]], "fr"), "\uFEFFa;b\r\n1;x\r\n");
  assert.equal(isoDate("2026-11-04T08:15:00+00:00"), "2026-11-04T08:15:00.000Z");
  assert.equal(isoDate(null), "");
});

test("fee settings input", () => {
  assert.equal(parsePercent("2"), 2);
  assert.equal(parsePercent("1,5"), 1.5);
  assert.equal(parsePercent(" 0.25 "), 0.25);
  assert.equal(parsePercent("0"), 0);
  assert.equal(parsePercent("1.555"), null);
  assert.equal(parsePercent("21"), null);
  assert.equal(parsePercent("-1"), null);
  assert.equal(parsePercent(""), null);
  assert.equal(parsePercent("abc"), null);
});

test("fee preview matches the worked example (2% + 1% on 10,000)", () => {
  const f = calculateFees(10000, { commissionPercent: 2, systemFeePercent: 1 });
  assert.equal(f.total_paid, 10300);
  assert.equal(f.agent_owed, 10200);
  assert.equal(f.system_fee, 100);
});

const days: DayRevenue[] = [
  { day: "2026-11-03", transactions: 1, system_fees: 50, pesapal_fees: 15, net_revenue: 35 },
  { day: "2026-11-02", transactions: 1, system_fees: 200, pesapal_fees: 25, net_revenue: 175 },
  { day: "2026-10-31", transactions: 2, system_fees: 60, pesapal_fees: null, net_revenue: null },
];

test("revenue totals: net is empty while any Pesapal fee is unknown", () => {
  assert.deepEqual(sumRevenue(days.slice(0, 2)), { transactions: 2, system_fees: 250, pesapal_fees: 40, net_revenue: 210 });
  const all = sumRevenue(days);
  assert.equal(all.system_fees, 310);
  assert.equal(all.net_revenue, null);
  assert.equal(all.pesapal_fees, null);
});

test("revenue by month, newest first", () => {
  const m = byMonth(days);
  assert.deepEqual(m.map((x) => x.month), ["2026-11", "2026-10"]);
  assert.equal(m[0].net_revenue, 210);
  assert.equal(m[1].net_revenue, null);
});

test("search filter", () => {
  assert.equal(searchFilter("   "), null);
  assert.equal(searchFilter("Aline"), "client_name.ilike.%Aline%");
  assert.equal(searchFilter("0788 123"), "client_name.ilike.%0788 123%,client_phone.ilike.%788123%");
  assert.equal(searchFilter("a,b)(c"), "client_name.ilike.%a b c%");
});

import { PESAPAL_FEE_PERCENT, pesapalFee } from "./pesapal.ts";
import { readFileSync } from "node:fs";

test("Pesapal fee: 3.5% of what the client paid, whole RWF", () => {
  assert.equal(PESAPAL_FEE_PERCENT, 3.5);
  assert.equal(pesapalFee(10300), 361); // 360.5 rounds up
  assert.equal(pesapalFee(10000), 350);
  assert.equal(pesapalFee(5150), 180);  // 180.25
  assert.equal(pesapalFee(0), 0);
});

test("Pesapal rate in the database migration matches the app", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/0006_pesapal_fee_rate.sql", import.meta.url), "utf8");
  assert.equal(sql.match(/v_rate constant numeric := ([\d.]+)/)?.[1], String(PESAPAL_FEE_PERCENT));
  assert.ok(sql.includes(`* ${PESAPAL_FEE_PERCENT} / 100`));
});

import { CONTACTS, displayPhone, telHref } from "./contact.ts";

test("contact details: tel links and display format", () => {
  assert.equal(telHref("0780322005"), "+250780322005");
  assert.equal(displayPhone("0789552231"), "0789 552 231");
  assert.deepEqual([...CONTACTS.sales.phones], ["0789552231", "0787788472"]);
  assert.equal(CONTACTS.support.email, "support@rahisicash.com");
  assert.equal(CONTACTS.sales.email, "info@rahisicash.com");
});
