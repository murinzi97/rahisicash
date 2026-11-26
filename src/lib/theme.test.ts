import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPref, parsePref, resolveTheme } from "./theme.ts";

test("theme: Auto follows the system, the others are fixed", () => {
  assert.equal(resolveTheme("auto", true), "night");
  assert.equal(resolveTheme("auto", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("night", false), "night");
});

test("theme: saved value is validated, default is Auto", () => {
  assert.equal(parsePref(null), "auto");
  assert.equal(parsePref("night"), "night");
  assert.equal(parsePref("<script>"), "auto");
});

test("theme: the admin button cycles Light, Night, Auto", () => {
  assert.equal(nextPref("light"), "night");
  assert.equal(nextPref("night"), "auto");
  assert.equal(nextPref("auto"), "light");
});
