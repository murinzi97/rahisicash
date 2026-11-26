import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePayout, showAccountNumber, changedRecently } from "./payoutMethod.ts";

const momo = { method: "mobile_money" as const, provider: "MTN MoMo", accountName: "Aline Uwase", accountNumber: "0788 123 456" };
const bank = { method: "bank" as const, provider: "Bank of Kigali", accountName: "Aline Uwase", accountNumber: "00040-1234567-89" };

test("mobile money number is normalised to +country format", () => {
  const r = validatePayout(momo);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.account_number, "+250788123456");
});

test("mobile money accepts other countries with a code, rejects junk", () => {
  assert.ok(validatePayout({ ...momo, accountNumber: "+254712345678" }).ok);
  assert.deepEqual(validatePayout({ ...momo, accountNumber: "12345" }), { ok: false, field: "accountNumber" });
  assert.deepEqual(validatePayout({ ...momo, accountNumber: "abc" }), { ok: false, field: "accountNumber" });
});

test("bank account number keeps its digits and dashes", () => {
  const r = validatePayout(bank);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.account_number, "00040-1234567-89");
});

test("bank account number rejects too short and odd characters", () => {
  assert.deepEqual(validatePayout({ ...bank, accountNumber: "12" }), { ok: false, field: "accountNumber" });
  assert.deepEqual(validatePayout({ ...bank, accountNumber: "1234;DROP" }), { ok: false, field: "accountNumber" });
});

test("names are trimmed, required and length-limited", () => {
  const r = validatePayout({ ...bank, provider: "  Bank   of  Kigali ", accountName: "  Aline   Uwase " });
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.value.provider, "Bank of Kigali"); assert.equal(r.value.account_name, "Aline Uwase"); }
  assert.deepEqual(validatePayout({ ...bank, provider: "" }), { ok: false, field: "provider" });
  assert.deepEqual(validatePayout({ ...bank, accountName: "A" }), { ok: false, field: "accountName" });
  assert.deepEqual(validatePayout({ ...bank, provider: "x".repeat(61) }), { ok: false, field: "provider" });
});

test("display: mobile money spaced, bank as typed", () => {
  assert.equal(showAccountNumber({ method: "mobile_money", account_number: "+250788123456" }), "+250 788 123 456");
  assert.equal(showAccountNumber({ method: "bank", account_number: "00040-1234567-89" }), "00040-1234567-89");
});

test("changedRecently: within 3 days only", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  assert.equal(changedRecently("2026-11-13T12:00:00Z", now), true);
  assert.equal(changedRecently("2026-11-10T11:00:00Z", now), false);
  assert.equal(changedRecently("not a date", now), false);
});
