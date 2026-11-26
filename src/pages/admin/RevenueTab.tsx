import { useState } from "react";
import { supabase } from "../../lib/supabase.ts";
import { fetchAll } from "../../lib/adminQuery.ts";
import { exportTable, type ExportFormat } from "../../lib/exportFile.ts";
import { formatDate, formatMonth, kigaliToday } from "../../lib/dates.ts";
import { formatRwf } from "../../lib/money.ts";
import { byMonth, sumRevenue, type DayRevenue } from "../../lib/revenue.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Banner, DateRange, ExportMenu, LoadGate, colsStyle, useLoad } from "./ui.tsx";

const COLS = "1.6fr 1fr 1.2fr 1.2fr 1.2fr";
const FIELDS = "day, transactions, system_fees, pesapal_fees, net_revenue";
const revenueQuery = (from: string, to: string) =>
  supabase.from("daily_revenue").select(FIELDS).gte("day", from).lte("day", to).order("day", { ascending: false });
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function toDay(r: Record<string, unknown>): DayRevenue {
  return {
    day: r.day as string, transactions: Number(r.transactions), system_fees: Number(r.system_fees),
    pesapal_fees: num(r.pesapal_fees), net_revenue: num(r.net_revenue),
  };
}

export default function RevenueTab() {
  const { t, lang } = useI18n();
  const today = kigaliToday();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [view, setView] = useState<"day" | "month">("day");
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);

  const list = useLoad(async () => {
    const { data, error } = await revenueQuery(from, to).limit(800);
    if (error) throw error;
    return (data as Record<string, unknown>[]).map(toDay);
  }, [from, to]);
  const days = list.data ?? [];
  const totals = sumRevenue(days);
  const rows = view === "day"
    ? days.map((d) => ({ key: d.day, label: formatDate(`${d.day}T12:00:00+02:00`, lang), ...d }))
    : byMonth(days).map((m) => ({ key: m.month, label: formatMonth(m.month, lang), day: m.month, ...m }));
  const money = (v: number | null) => (v === null ? "—" : formatRwf(v, lang));

  async function runExport(format: ExportFormat) {
    setExporting(true);
    setFailed(false);
    try {
      const all = (await fetchAll<Record<string, unknown>>((a, b) => revenueQuery(from, to).range(a, b))).map(toDay);
      const headers = [t("admin.col.day"), t("admin.col.transactions"), t("admin.col.systemFees"), t("admin.col.pesapalFees"), t("admin.col.netRevenue")];
      const body = all.map((d) => [d.day, d.transactions, d.system_fees, d.pesapal_fees, d.net_revenue]);
      exportTable({
        format, filename: `revenue-${from}_${to}`, lang,
        title: t("admin.tab.revenue"),
        subtitle: t("export.subtitle", { from, to, n: String(all.length) }),
        csvHeaders: headers, csvRows: body,
        pdfHeaders: headers,
        pdfRows: all.map((d) => [formatDate(`${d.day}T12:00:00+02:00`, lang), String(d.transactions), money(d.system_fees), money(d.pesapal_fees), money(d.net_revenue)]),
        pdfAlign: ["l", "r", "r", "r", "r"],
        footerLeft: t("export.generated", { date: formatDate(new Date().toISOString(), lang) }),
        pageLabel: (n, m) => t("export.page", { n: String(n), m: String(m) }),
      });
    } catch { setFailed(true); }
    setExporting(false);
  }

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">{t("admin.tab.revenue")}</h1>
        <div className="toolbar-tools">
          <div className="chips" style={{ margin: 0 }} role="group" aria-label={t("admin.tab.revenue")}>
            {(["day", "month"] as const).map((v) => (
              <button key={v} type="button" className={"chip" + (view === v ? " is-on" : "")} aria-pressed={view === v} onClick={() => setView(v)}>
                {t(v === "day" ? "admin.rev.byDay" : "admin.rev.byMonth")}
              </button>
            ))}
          </div>
          <ExportMenu disabled={exporting || days.length === 0} onPick={(f) => void runExport(f)} />
        </div>
      </div>
      <div className="filters">
        <DateRange from={from} to={to} max={today} onChange={(a, b) => { setFrom(a); setTo(b); }} />
      </div>
      <p className="footnote">{t("admin.export.note")}</p>
      {failed && <Banner kind="bad" text={t("csv.error")} />}

      <LoadGate state={list.state} onRetry={list.reload} errorKey="admin.rev.error">
        {days.length === 0 ? <p className="muted">{t("admin.noMatch")}</p> : (
          <>
            <div className="dt" style={colsStyle(COLS)}>
              <div className="dt-head" aria-hidden="true">
                <span>{t(view === "day" ? "admin.col.day" : "admin.col.month")}</span>
                <span className="dt-money">{t("admin.col.transactions")}</span><span className="dt-money">{t("admin.col.systemFees")}</span>
                <span className="dt-money">{t("admin.col.pesapalFees")}</span><span className="dt-money">{t("admin.col.netRevenue")}</span>
              </div>
              {rows.map((r) => (
                <article key={r.key} className="dt-row">
                  <span className="dt-cell"><strong>{r.label}</strong></span>
                  <span className="dt-cell dt-money" data-label={t("admin.col.transactions")}>{r.transactions}</span>
                  <span className="dt-cell dt-money" data-label={t("admin.col.systemFees")}>{formatRwf(r.system_fees, lang)}</span>
                  <span className="dt-cell dt-money" data-label={t("admin.col.pesapalFees")}>{money(r.net_revenue === null ? null : r.pesapal_fees)}</span>
                  <span className="dt-cell dt-money" data-label={t("admin.col.netRevenue")}>{money(r.net_revenue)}</span>
                </article>
              ))}
              <article className="dt-row dt-total">
                <span className="dt-cell">{t("common.total")}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.transactions")}>{totals.transactions}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.systemFees")}>{formatRwf(totals.system_fees, lang)}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.pesapalFees")}>{money(totals.pesapal_fees)}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.netRevenue")}>{money(totals.net_revenue)}</span>
              </article>
            </div>
            <p className="footnote">{t("admin.rev.note")}</p>
          </>
        )}
      </LoadGate>
    </>
  );
}
