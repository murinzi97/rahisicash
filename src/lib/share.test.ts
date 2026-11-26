import { test } from "node:test";
import assert from "node:assert/strict";
import { mailtoUrl, whatsappUrl, type ShareTx } from "./share.ts";
import { pillFor, FILTER_STATUSES } from "./transactions.ts";

const tx: ShareTx = {
  client_name: "Jean", client_phone: "+250788123456", client_email: "jean@example.com",
  client_language: "en", amount: 10000, total_paid: 10300, payment_link: "https://pay.example/p/8Kd2xQ?a=1&b=2",
};

test("WhatsApp link: number without +, message in English, link intact", () => {
  const u = new URL(whatsappUrl(tx, "Aline"));
  assert.equal(u.origin + u.pathname, "https://wa.me/250788123456");
  const text = u.searchParams.get("text")!;
  assert.match(text, /Hello Jean/);
  assert.match(text, /RWF 10,000/);
  assert.match(text, /RWF 10,300/);
  assert.ok(text.endsWith(tx.payment_link));
});
test("WhatsApp message follows the CLIENT's language, with French money format", () => {
  const text = new URL(whatsappUrl({ ...tx, client_language: "fr" }, "Aline")).searchParams.get("text")!;
  assert.match(text, /Bonjour Jean/);
  assert.match(text, /10\u202f000\u202fRWF/);
});
test("a $ in a name or link is not treated as a pattern", () => {
  const text = new URL(whatsappUrl({ ...tx, client_name: "A$&B" }, "Aline")).searchParams.get("text")!;
  assert.match(text, /Hello A\$&B,/);
});
test("email: only when the client gave one; subject and body in client language", () => {
  assert.equal(mailtoUrl({ ...tx, client_email: null }, "Aline"), null);
  const u = mailtoUrl({ ...tx, client_language: "fr" }, "Aline")!;
  assert.ok(u.startsWith("mailto:jean@example.com?"));
  const q = new URLSearchParams(u.split("?")[1]);
  assert.equal(q.get("subject"), "Votre lien de paiement Rahisi Cash");
  assert.match(q.get("body")!, /Bonjour Jean,\n\n/);
});
test("report filters and badge colours follow the spec", () => {
  assert.deepEqual(FILTER_STATUSES.unpaid, ["pending", "failed", "expired"]);
  assert.equal(FILTER_STATUSES.all, null);
  assert.deepEqual(pillFor("paid", "report"), ["pill-ok", "status.paid"]);
  assert.deepEqual(pillFor("pending", "order"), ["pill-warn", "status.waiting"]);
  assert.deepEqual(pillFor("pending", "report"), ["pill-warn", "status.unpaid"]);
  for (const s of ["failed", "expired", "voided"] as const) assert.equal(pillFor(s, "report")[0], "pill-bad");
});
