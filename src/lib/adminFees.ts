/** Safety cap against typing 200 instead of 2. The admin-money Edge Function uses the same number. */
export const MAX_PERCENT = 20;

/** "1.5" or "1,5" -> 1.5. Returns null unless it is 0 to MAX_PERCENT with at most 2 decimals. */
export function parsePercent(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= MAX_PERCENT ? n : null;
}
