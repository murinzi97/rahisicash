/** Rahisi Cash contact details. Change them here; the Contact and Privacy pages both read from this file. */
export const CONTACTS = {
  support: { phones: ["0780322005"], email: "support@rahisicash.com" },
  sales: { phones: ["0789552231", "0787788472"], email: "info@rahisicash.com" },
} as const;

/** "0780322005" -> "+250780322005" (for tel: links). */
export function telHref(local: string): string {
  return `+250${local.replace(/\D/g, "").replace(/^0/, "")}`;
}

/** "0780322005" -> "0780 322 005". */
export function displayPhone(local: string): string {
  const d = local.replace(/\D/g, "");
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`.trim();
}
