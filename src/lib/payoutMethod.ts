import { normalizeClientPhone, formatPhone } from "./phone.ts";

export type PayoutKind = "bank" | "mobile_money";

export interface PayoutMethod {
  method: PayoutKind;
  provider: string;
  account_name: string;
  account_number: string; // bank: as typed (cleaned); mobile money: +country format
  updated_at: string;
}

export interface PayoutInput { method: PayoutKind; provider: string; accountName: string; accountNumber: string }
export type PayoutField = "provider" | "accountName" | "accountNumber";
export type PayoutResult =
  | { ok: true; value: { method: PayoutKind; provider: string; account_name: string; account_number: string } }
  | { ok: false; field: PayoutField };

const BANK_NUMBER = /^[0-9A-Za-z ./-]{4,34}$/; // same rule as the database

/** Checks and cleans the form. The database enforces the same rules again. */
export function validatePayout(i: PayoutInput): PayoutResult {
  const provider = i.provider.trim().replace(/\s+/g, " ");
  const name = i.accountName.trim().replace(/\s+/g, " ");
  if (provider.length < 2 || provider.length > 60) return { ok: false, field: "provider" };
  if (name.length < 2 || name.length > 120) return { ok: false, field: "accountName" };

  let number: string;
  if (i.method === "mobile_money") {
    const p = normalizeClientPhone(i.accountNumber);
    if (!p) return { ok: false, field: "accountNumber" };
    number = p;
  } else {
    number = i.accountNumber.trim().replace(/\s+/g, " ");
    if (!BANK_NUMBER.test(number)) return { ok: false, field: "accountNumber" };
  }
  return { ok: true, value: { method: i.method, provider, account_name: name, account_number: number } };
}

/** How the number is shown: mobile money numbers are spaced, bank numbers stay as typed. */
export function showAccountNumber(m: Pick<PayoutMethod, "method" | "account_number">): string {
  return m.method === "mobile_money" ? formatPhone(m.account_number) : m.account_number;
}

/** A payout option changed in the last few days deserves a call to the agent before paying. */
export function changedRecently(updatedAt: string, now: number = Date.now(), days = 3): boolean {
  const t = new Date(updatedAt).getTime();
  return Number.isFinite(t) && now - t < days * 86_400_000;
}

export function toPayoutMethod(r: Record<string, unknown>): PayoutMethod {
  return {
    method: r.method as PayoutKind, provider: r.provider as string, account_name: r.account_name as string,
    account_number: r.account_number as string, updated_at: r.updated_at as string,
  };
}
