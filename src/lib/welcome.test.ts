import { test } from "node:test";
import assert from "node:assert/strict";
import { stepSlide } from "./welcome.ts";
import { startRoute } from "./routing.ts";

test("slides stay within the first and last", () => {
  assert.equal(stepSlide(0, -1), 0);
  assert.equal(stepSlide(0, 1), 1);
  assert.equal(stepSlide(2, 1), 2);
  assert.equal(stepSlide(2, -1), 1);
});

test("first-time visitors without a session see the welcome screens", () => {
  assert.equal(startRoute(false, null, false), "/welcome");
  assert.equal(startRoute(false, null, true), "/login");
});

test("signed-in people never see the welcome screens", () => {
  assert.equal(startRoute(true, { role: "agent", status: "active" }, false), "/agent");
  assert.equal(startRoute(true, { role: "admin", status: "active" }, false), "/admin");
  assert.equal(startRoute(true, { role: "agent", status: "pending" }, false), "/pending");
});
