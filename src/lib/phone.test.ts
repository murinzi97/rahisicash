import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAgentPhone, normalizeClientPhone, maskPhone, formatPhone } from "./phone.ts";

test("Rwanda: the usual ways of writing a number", () => {
  for (const v of ["0788123456", "788123456", "+250788123456", "250788123456",
                   "0788 123 456", "0788-123-456", "00250788123456", "(0788) 123456"]) {
    assert.equal(normalizeClientPhone(v), "+250788123456", v);
    assert.equal(normalizeAgentPhone(v), "+250788123456", v);
  }
});
test("Rwanda: all four mobile prefixes", () => {
  for (const p of ["72", "73", "78", "79"]) {
    assert.equal(normalizeAgentPhone(`0${p}1234567`), `+250${p}1234567`);
  }
});
test("DR Congo: the usual ways of writing a number", () => {
  for (const v of ["0812345678", "812345678", "+243812345678", "243812345678",
                   "0812 345 678", "00243812345678", "+243 81 234 5678"]) {
    assert.equal(normalizeAgentPhone(v), "+243812345678", v);
  }
});
test("DR Congo: 08x and 09x numbers both work", () => {
  assert.equal(normalizeAgentPhone("0991234567"), "+243991234567");
  assert.equal(normalizeAgentPhone("0841234567"), "+243841234567");
});
test("agents cannot use a number from another country", () => {
  assert.equal(normalizeAgentPhone("+254712345678"), null);
  assert.equal(normalizeAgentPhone("+14155552671"), null);
});
test("clients: numbers from anywhere in the world", () => {
  assert.equal(normalizeClientPhone("+254 712 345 678"), "+254712345678");   // Kenya
  assert.equal(normalizeClientPhone("+1 (415) 555-2671"), "+14155552671");   // USA
  assert.equal(normalizeClientPhone("0044 7911 123456"), "+447911123456");   // UK, 00 form
  assert.equal(normalizeClientPhone("+33 6 12 34 56 78"), "+33612345678");   // France
  assert.equal(normalizeClientPhone("+91 98765 43210"), "+919876543210");    // India
});
test("clients: Rwanda and Congo local numbers still work, with the strict rules", () => {
  assert.equal(normalizeClientPhone("0788123456"), "+250788123456");
  assert.equal(normalizeClientPhone("0812345678"), "+243812345678");
  assert.equal(normalizeClientPhone("+250 711 234 567"), null);   // not a valid Rwandan prefix
  assert.equal(normalizeClientPhone("+243 71 234 5678"), null);   // Congo mobiles start 8 or 9
});
test("clients: a foreign local number without a country code is refused", () => {
  assert.equal(normalizeClientPhone("0712345678"), null);   // looks Kenyan, but no country code
});
test("clients: malformed international numbers are refused", () => {
  for (const v of ["+12345", "+0123456789", "+1234567890123456", "+", "", "+44abc1234567"]) {
    assert.equal(normalizeClientPhone(v), null, v);
  }
});
test("rejects numbers from anywhere else or malformed", () => {
  for (const v of ["", "123", "0711234567", "07881234", "07881234567",
                   "+254788123456", "+242061234567", "abcdefghij", "+2500788123456",
                   "+24381234567", "+2438123456789", "081234567"]) {
    assert.equal(normalizeAgentPhone(v), null, v);
  }
});
test("masking works for every country", () => {
  assert.equal(maskPhone("+250788123456"), "0788 *** 456");
  assert.equal(maskPhone("+243812345678"), "0812 *** 678");
  assert.equal(maskPhone("+254712345678"), "+254 *** 678");
  assert.equal(maskPhone(null), "");
});
test("full display", () => {
  assert.equal(formatPhone("+250788123456"), "+250 788 123 456");
  assert.equal(formatPhone("+243812345678"), "+243 812 345 678");
  assert.equal(formatPhone("+254712345678"), "+254 712 345 678");
  assert.equal(formatPhone(null), "");
});
