export interface DayRevenue {
  day: string; // YYYY-MM-DD, Kigali day
  transactions: number;
  system_fees: number;
  pesapal_fees: number | null;
  net_revenue: number | null; // empty while any Pesapal fee of that day is unknown
}

export interface RevenueTotals {
  transactions: number;
  system_fees: number;
  pesapal_fees: number | null; // empty unless every day is fully known
  net_revenue: number | null;
}

export function sumRevenue(days: DayRevenue[]): RevenueTotals {
  const known = days.every((d) => d.net_revenue !== null && d.pesapal_fees !== null);
  return {
    transactions: days.reduce((a, d) => a + d.transactions, 0),
    system_fees: days.reduce((a, d) => a + d.system_fees, 0),
    pesapal_fees: known ? days.reduce((a, d) => a + (d.pesapal_fees ?? 0), 0) : null,
    net_revenue: known ? days.reduce((a, d) => a + (d.net_revenue ?? 0), 0) : null,
  };
}

/** One row per month ("YYYY-MM"), newest first. */
export function byMonth(days: DayRevenue[]): (RevenueTotals & { month: string })[] {
  const groups = new Map<string, DayRevenue[]>();
  for (const d of days) {
    const m = d.day.slice(0, 7);
    groups.set(m, [...(groups.get(m) ?? []), d]);
  }
  return [...groups.entries()]
    .map(([month, list]) => ({ month, ...sumRevenue(list) }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
