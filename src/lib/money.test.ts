import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRwf, groupDigits } from "./money.ts";

test("English format", () => {
  assert.equal(formatRwf(10000, "en"), "RWF 10,000");
  assert.equal(formatRwf(35350, "en"), "RWF 35,350");
  assert.equal(formatRwf(0, "en"), "RWF 0");
  assert.equal(formatRwf(999, "en"), "RWF 999");
  assert.equal(formatRwf(1234567, "en"), "RWF 1,234,567");
});
test("French format", () => {
  assert.equal(formatRwf(10000, "fr"), "10\u202f000\u202fRWF");
  assert.equal(formatRwf(300, "fr"), "300\u202fRWF");
});
test("negative amounts keep the sign", () => {
  assert.equal(formatRwf(-5000, "en"), "-RWF 5,000");
});

test("groupDigits formats while typing", () => {
  assert.equal(groupDigits("10000", "en"), "10,000");
  assert.equal(groupDigits("10000", "fr"), "10\u202f000");
  assert.equal(groupDigits("1,2a3", "en"), "123");
  assert.equal(groupDigits("007", "en"), "7");
  assert.equal(groupDigits("", "en"), "");
});
