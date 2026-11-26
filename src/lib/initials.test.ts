import { test } from "node:test";
import assert from "node:assert/strict";
import { initials } from "./initials.ts";

test("initials", () => {
  assert.equal(initials("Aline Uwase"), "AU");
  assert.equal(initials("jean bosco mugisha"), "JM");
  assert.equal(initials("Eric"), "E");
  assert.equal(initials("   "), "?");
});
