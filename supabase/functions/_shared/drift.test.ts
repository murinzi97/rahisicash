// The Edge Functions are single files (easy to paste into the Supabase editor),
// so they hold COPIES of shared code. These tests fail if a copy and its source differ.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const norm = (t: string) =>
  t.replace(/^export /gm, "").split("\n").map((l) => l.trimEnd()).join("\n").trim();

/** Text between "// BEGIN shared: <name>" and "// END shared: <name>" lines. */
function block(src: string, name: string): string {
  const lines = src.split("\n");
  const a = lines.findIndex((l) => l.startsWith(`// BEGIN shared: ${name}`));
  const b = lines.findIndex((l) => l.startsWith(`// END shared: ${name}`));
  assert.ok(a >= 0 && b > a, `block "${name}" not found`);
  return lines.slice(a + 1, b).join("\n");
}

const create = read("../create-payment/index.ts");
const ipn = read("../pesapal-ipn/index.ts");

test("create-payment: fees copy matches _shared/fees.ts", () => {
  assert.equal(norm(block(create, "fees")), norm(read("./fees.ts")));
});

test("create-payment: phone copy matches src/lib/phone.ts", () => {
  const phone = read("../../../src/lib/phone.ts");
  const a = phone.indexOf("\n") + 1;
  const b = phone.indexOf("// END shared-with-edge-function");
  assert.ok(a > 0 && b > a, "marked block missing in src/lib/phone.ts");
  assert.equal(norm(block(create, "phone")), norm(phone.slice(a, b)));
});

test("both functions: Pesapal client copy matches _shared/pesapal.ts", () => {
  const src = norm(read("./pesapal.ts"));
  assert.equal(norm(block(create, "pesapal")), src);
  assert.equal(norm(block(ipn, "pesapal")), src);
});

test("the IPN function is deployed without a login token, so it must never trust the request body for money", () => {
  // Guard rails: the IPN must ask Pesapal for the status and must not read amounts from the request.
  assert.match(ipn, /GetTransactionStatus/);
  assert.doesNotMatch(ipn, /q\.get\("amount"\)|b\?\.amount/i);
});

test("admin preview: src/lib/fees.ts is identical to _shared/fees.ts", () => {
  assert.equal(norm(read("../../../src/lib/fees.ts")), norm(read("./fees.ts")));
});

test("admin-money and the Fee Settings screen use the same percentage cap", () => {
  const cap = (s: string) => s.match(/MAX_PERCENT = (\d+)/)?.[1];
  assert.ok(cap(read("../admin-money/index.ts")));
  assert.equal(cap(read("../admin-money/index.ts")), cap(read("../../../src/lib/adminFees.ts")));
});
