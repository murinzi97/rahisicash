// BEGIN shared-with-edge-function: phone (create-payment/index.ts holds an identical copy; npm test checks)
const RW = /^7[2389]\d{7}$/;   // Rwanda: 72, 73, 78, 79 + 7 digits
const CD = /^[89]\d{8}$/;      // DR Congo mobile: 8 or 9 + 8 digits (9 digits in all)

function clean(input: string): string {
  return input.replace(/[\s\-().]/g, "");
}

/**
 * Agent phones: Rwanda (+250) or DR Congo (+243).
 * With a country code (+, 00, or a leading 250/243) the code decides.
 * Without one, the number is read as local: 07x is Rwanda, 08x/09x is DR Congo.
 * Operator prefixes are not checked for DR Congo (sources disagree on them).
 */
export function normalizeAgentPhone(input: string): string | null {
  let d = clean(input);
  let intl = false;
  if (d.startsWith("+")) { d = d.slice(1); intl = true; }
  else if (d.startsWith("00")) { d = d.slice(2); intl = true; }

  if (d.startsWith("250") && (intl || d.length === 12)) {
    return RW.test(d.slice(3)) ? `+${d}` : null;
  }
  if (d.startsWith("243") && (intl || d.length === 12)) {
    return CD.test(d.slice(3)) ? `+${d}` : null;
  }
  if (intl) return null;

  if (d.startsWith("0")) d = d.slice(1);
  if (RW.test(d)) return `+250${d}`;
  if (CD.test(d)) return `+243${d}`;
  return null;
}

/**
 * CLIENT phones (the customer who pays the link) can be from ANY country.
 * - "+..." or "00..." : international format. Rwanda and DR Congo numbers get the
 *   same strict checks as agents; every other country is checked as E.164 only
 *   (7 to 15 digits, no leading 0). This cannot tell whether a number really
 *   exists in that country.
 * - No country code: read as a Rwandan or Congolese local number (07x / 08x / 09x).
 *   Anything else must be typed with its country code.
 */
export function normalizeClientPhone(input: string): string | null {
  let d = clean(input);
  let intl = false;
  if (d.startsWith("+")) { d = d.slice(1); intl = true; }
  else if (d.startsWith("00")) { d = d.slice(2); intl = true; }

  if (!intl) return normalizeAgentPhone(input);

  if (d.startsWith("250") || d.startsWith("243")) return normalizeAgentPhone(`+${d}`);
  return /^[1-9]\d{6,14}$/.test(d) ? `+${d}` : null;
}
// END shared-with-edge-function: phone

/** "+250788123456" -> "0788 *** 456", "+243812345678" -> "0812 *** 678", "+254712345678" -> "+254 *** 678". */
export function maskPhone(p: string | null): string {
  if (!p) return "";
  if (/^\+(250|243)\d{9}$/.test(p)) {
    const n = "0" + p.slice(4);
    return `${n.slice(0, 4)} *** ${n.slice(-3)}`;
  }
  if (/^\+[1-9]\d{6,14}$/.test(p)) return `${p.slice(0, 4)} *** ${p.slice(-3)}`;
  return p;
}

/**
 * Full number, for admins: "+250788123456" -> "+250 788 123 456".
 * Other countries: digits in groups of three from the left ("+254712345678" ->
 * "+254 712 345 678"). Country codes differ in length, so for those the grouping is
 * only for readability. The spaces also stop Excel from turning the number into a
 * plain numeric value and dropping the "+".
 */
export function formatPhone(p: string | null): string {
  if (!p) return "";
  if (/^\+(250|243)\d{9}$/.test(p)) {
    return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7, 10)} ${p.slice(10)}`;
  }
  if (/^\+[1-9]\d{6,14}$/.test(p)) return "+" + p.slice(1).replace(/(\d{3})(?=\d)/g, "$1 ");
  return p;
}
