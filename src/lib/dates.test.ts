import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, kigaliToday, monthStart, rangeBounds } from "./dates.ts";

test("kigaliToday uses Rwanda time (UTC+2), not UTC", () => {
  assert.equal(kigaliToday(new Date("2026-11-04T23:30:00Z")), "2026-11-05");
  assert.equal(kigaliToday(new Date("2026-11-04T21:59:00Z")), "2026-11-04");
});
test("monthStart", () => assert.equal(monthStart("2026-11-17"), "2026-11-01"));
test("rangeBounds covers whole Kigali days, inclusive of the last day", () => {
  const b = rangeBounds("2026-11-01", "2026-11-04");
  assert.equal(b.gte, "2026-10-31T22:00:00.000Z");
  assert.equal(b.lt, "2026-11-04T22:00:00.000Z");
});
test("rangeBounds rolls over month and year ends", () => {
  assert.equal(rangeBounds("2026-12-31", "2026-12-31").lt, "2026-12-31T22:00:00.000Z");
  assert.equal(rangeBounds("2026-02-28", "2026-02-28").lt, "2026-02-28T22:00:00.000Z");
});
test("formatDate follows the language", () => {
  assert.equal(formatDate("2026-11-04T10:00:00Z", "en"), "4 Nov 2026");
  assert.match(formatDate("2026-11-04T10:00:00Z", "fr"), /^4 nov\.? 2026$/);
});
