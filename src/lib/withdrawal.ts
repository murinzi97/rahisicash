import { en, type Key } from "../i18n/en.ts";

/** Smallest withdrawal in RWF. The server enforces the same number (create-payment/index.ts). */
export const MIN_AMOUNT = 1000;

export interface Quote {
  amount: number;
  total_fee: number;   // "Transaction fee" (commission + system fee; the split is never shown to agents)
  total_paid: number;  // what the client is charged
  agent_owed: number;  // what the agent will be owed
}

export interface CreatedPayment {
  transaction_id: string;
  payment_link: string;
  status: string;
  quote: Quote;
}

export type TxStatus = "pending" | "paid" | "failed" | "expired" | "voided";

/** Turns an error code from an Edge Function into a translated message key. */
export function errorKeyFor(code: string): Key {
  const k = `error.${code}`;
  return k in en ? (k as Key) : "error.unknown";
}
