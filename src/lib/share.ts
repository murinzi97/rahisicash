import { translate } from "../i18n/translate.ts";
import { formatRwf } from "./money.ts";
import type { Lang } from "./types.ts";

export interface ShareTx {
  client_name: string;
  client_phone: string;          // E.164, e.g. +250788123456
  client_email: string | null;
  client_language: Lang;         // the language chosen for THIS withdrawal
  amount: number;
  total_paid: number;
  payment_link: string;
}

function vars(tx: ShareTx, agentName: string) {
  return {
    name: tx.client_name,
    agent: agentName,
    cash: formatRwf(tx.amount, tx.client_language),
    total: formatRwf(tx.total_paid, tx.client_language),
    link: tx.payment_link,
  };
}

/** wa.me link with the message pre-filled in the client's language. */
export function whatsappUrl(tx: ShareTx, agentName: string): string {
  const text = translate(tx.client_language, "msg.whatsapp", vars(tx, agentName));
  return `https://wa.me/${tx.client_phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** mailto: link (opens the agent's own mail app), or null when no client email was given. */
export function mailtoUrl(tx: ShareTx, agentName: string): string | null {
  if (!tx.client_email) return null;
  const subject = translate(tx.client_language, "msg.emailSubject");
  const body = translate(tx.client_language, "msg.emailBody", vars(tx, agentName));
  return `mailto:${tx.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
