import { test } from "node:test";
import assert from "node:assert/strict";
import { routeFor } from "./routing.ts";

test("no session goes to login", () => {
  assert.equal(routeFor(false, null), "/login");
  assert.equal(routeFor(false, { role: "admin", status: "active" }), "/login");
});
test("session but no profile goes to login", () => {
  assert.equal(routeFor(true, null), "/login");
});
test("active agent -> agent home", () => {
  assert.equal(routeFor(true, { role: "agent", status: "active" }), "/agent");
});
test("pending agent -> pending screen", () => {
  assert.equal(routeFor(true, { role: "agent", status: "pending" }), "/pending");
});
test("rejected and suspended agents -> blocked", () => {
  assert.equal(routeFor(true, { role: "agent", status: "rejected" }), "/blocked");
  assert.equal(routeFor(true, { role: "agent", status: "suspended" }), "/blocked");
});
test("active admin -> admin portal; inactive admin -> blocked", () => {
  assert.equal(routeFor(true, { role: "admin", status: "active" }), "/admin");
  assert.equal(routeFor(true, { role: "admin", status: "suspended" }), "/blocked");
  assert.equal(routeFor(true, { role: "admin", status: "pending" }), "/blocked");
});
test("an unexpected status never reaches a portal", () => {
  assert.equal(routeFor(true, { role: "agent", status: "weird" as never }), "/blocked");
});
