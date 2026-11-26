import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFees } from "./fees.ts";

const base = { commissionPercent: 2, systemFeePercent: 1 };

test("spec example: 10,000 at 2% + 1%", () => {
  const r = calculateFees(10000, base);
  assert.equal(r.agent_commission, 200);
  assert.equal(r.system_fee, 100);
  assert.equal(r.total_fee, 300);
  assert.equal(r.total_paid, 10300);
  assert.equal(r.agent_owed, 10200);
});

test("decimals: 1.5% commission on 10,000", () => {
  const r = calculateFees(10000, { commissionPercent: 1.5, systemFeePercent: 1 });
  assert.equal(r.agent_commission, 150);
  assert.equal(r.system_fee, 100);
  assert.equal(r.total_paid, 10250);
});

test("half rounds up and parts still add up: 1,250", () => {
  const r = calculateFees(1250, base); // 25 commission, 3% = 37.5 -> 38
  assert.equal(r.agent_commission, 25);
  assert.equal(r.total_fee, 38);
  assert.equal(r.system_fee, 13);
});

test("odd amount: 333", () => {
  const r = calculateFees(333, base); // 6.66 -> 7, 9.99 -> 10
  assert.equal(r.agent_commission, 7);
  assert.equal(r.total_fee, 10);
  assert.equal(r.system_fee, 3);
});

test("zero system fee", () => {
  const r = calculateFees(10000, { commissionPercent: 2, systemFeePercent: 0 });
  assert.equal(r.system_fee, 0);
  assert.equal(r.total_paid, 10200);
});

test("invariants hold for 20,000 random cases", () => {
  for (let i = 0; i < 20000; i++) {
    const amount = 1 + Math.floor(Math.random() * 5_000_000);
    const c = Math.round(Math.random() * 1000) / 100; // 0.00 to 10.00
    const s = Math.round(Math.random() * 500) / 100; // 0.00 to 5.00
    const r = calculateFees(amount, { commissionPercent: c, systemFeePercent: s });
    assert.equal(r.total_fee, r.agent_commission + r.system_fee);
    assert.equal(r.total_paid, r.amount + r.total_fee);
    assert.equal(r.agent_owed, r.amount + r.agent_commission);
    assert.ok(r.system_fee >= 0 && r.agent_commission >= 0);
    assert.ok(Number.isInteger(r.total_paid));
  }
});

test("rejects bad input", () => {
  assert.throws(() => calculateFees(0, base));
  assert.throws(() => calculateFees(-5, base));
  assert.throws(() => calculateFees(100.5, base));
  assert.throws(() => calculateFees(NaN, base));
  assert.throws(() => calculateFees(1000, { commissionPercent: -1, systemFeePercent: 1 }));
  assert.throws(() => calculateFees(1000, { commissionPercent: 2, systemFeePercent: 101 }));
  assert.throws(() => calculateFees(1000, { commissionPercent: 1.234, systemFeePercent: 1 }));
});
