/**
 * Pesapal charges 3.5% of what the client pays. The database fills the fee in when a payment
 * is confirmed (migration 0006, same number); this copy is only for the Fee Settings preview.
 */
export const PESAPAL_FEE_PERCENT = 3.5;

/** Whole RWF, halves round up (same as the database's round()). total * 3.5 / 100 = total * 35 / 1000. */
export function pesapalFee(totalPaid: number): number {
  return Math.round((totalPaid * 35) / 1000);
}
