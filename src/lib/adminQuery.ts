/** Reads every page of a query (the API returns at most 1000 rows per request). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  max = 20000,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/** Text typed into the search box -> a PostgREST "or" filter on client name and phone, or null. */
export function searchFilter(input: string): string | null {
  const s = input.trim().replace(/[,()%*\\:"]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const parts = [`client_name.ilike.%${s}%`];
  const digits = s.replace(/[\s\-+]/g, "");
  // Phones are stored as +250788..., so "0788 123" is searched as "788123".
  if (/^\d{3,}$/.test(digits)) parts.push(`client_phone.ilike.%${digits.replace(/^0+/, "")}%`);
  return parts.join(",");
}
