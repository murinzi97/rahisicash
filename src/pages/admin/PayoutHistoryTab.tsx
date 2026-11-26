import { useState } from "react";
import { supabase } from "../../lib/supabase.ts";
import { fetchAll } from "../../lib/adminQuery.ts";
import { isoDate } from "../../lib/csv.ts";
import { exportTable, type ExportFormat } from "../../lib/exportFile.ts";
import { formatDate, kigaliToday } from "../../lib/dates.ts";
import { formatRwf } from "../../lib/money.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Banner, DateRange, ExportMenu, LoadGate, colsStyle, useLoad } from "./ui.tsx";

interface Payout { id: string; payout_date: string; agent_name: string; tx_count: number; total_amount: number; created_at: string }
const COLS = "1fr 2fr 1fr 1.2fr 1fr";
const SELECT = "id, payout_date, tx_count, total_amount, created_at, agent:profiles!agent_id(full_name)";
const payoutQuery = (from: string, to: string, agent: string) => {
  let q = supabase.from("payouts").select(SELECT).gte("payout_date", from).lte("payout_date", to)
    .order("created_at", { ascending: false });
  if (agent) q = q.eq("agent_id", agent);
  return q;
};

function toRow(r: Record<string, unknown>): Payout {
  return {
    id: r.id as string, payout_date: r.payout_date as string, tx_count: Number(r.tx_count), total_amount: Number(r.total_amount),
    created_at: r.created_at as string, agent_name: (r.agent as { full_name?: string } | null)?.full_name ?? "",
  };
}

export default function PayoutHistoryTab() {
  const { t, lang } = useI18n();
  const today = kigaliToday();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [agent, setAgent] = useState("");
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);

  const agents = useLoad(async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name").eq("role", "agent").order("full_name");
    if (error) throw error;
    return data as { id: string; full_name: string }[];
  }, []);

  const list = useLoad(async () => {
    const { data, error } = await payoutQuery(from, to, agent).limit(500);
    if (error) throw error;
    return (data as unknown as Record<string, unknown>[]).map(toRow);
  }, [from, to, agent]);
  const rows = list.data ?? [];

  async function runExport(format: ExportFormat) {
    setExporting(true);
    setFailed(false);
    try {
      const all = (await fetchAll<Record<string, unknown>>((a, b) => payoutQuery(from, to, agent).range(a, b))).map(toRow);
      const headers = ["ID", t("csv.payoutDate"), t("admin.col.agent"), t("admin.col.transactions"), t("admin.col.amountRwf"), t("admin.col.status"), t("csv.recordedAt")];
      const body = all.map((r) => [r.id, r.payout_date, r.agent_name, r.tx_count, r.total_amount, "paid", isoDate(r.created_at)]);
      exportTable({
        format, filename: `payouts-${from}_${to}`, lang,
        title: t("admin.tab.payoutHistory"),
        subtitle: t("export.subtitle", { from, to, n: String(all.length) }),
        csvHeaders: headers, csvRows: body,
        pdfHeaders: [t("csv.payoutDate"), t("admin.col.agent"), t("admin.col.transactions"), t("admin.col.amountRwf"), t("admin.col.status")],
        pdfRows: all.map((r) => [formatDate(`${r.payout_date}T12:00:00+02:00`, lang), r.agent_name, String(r.tx_count), formatRwf(r.total_amount, lang), t("status.paid")]),
        pdfAlign: ["l", "l", "r", "r", "l"],
        footerLeft: t("export.generated", { date: formatDate(new Date().toISOString(), lang) }),
        pageLabel: (n, m) => t("export.page", { n: String(n), m: String(m) }),
      });
    } catch { setFailed(true); }
    setExporting(false);
  }

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">{t("admin.tab.payoutHistory")}</h1>
        <ExportMenu disabled={exporting || rows.length === 0} onPick={(f) => void runExport(f)} />
      </div>
      <div className="filters">
        <DateRange from={from} to={to} max={today} onChange={(a, b) => { setFrom(a); setTo(b); }} />
        <select className="input" aria-label={t("admin.filter.allAgents")} value={agent} onChange={(e) => setAgent(e.target.value)}>
          <option value="">{t("admin.filter.allAgents")}</option>
          {(agents.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>
      <p className="footnote">{t("admin.export.note")}</p>
      {failed && <Banner kind="bad" text={t("csv.error")} />}
      <LoadGate state={list.state} onRetry={list.reload} errorKey="admin.history.error">
        {rows.length === 0 ? <p className="muted">{t("admin.noMatch")}</p> : (
          <div className="dt" style={colsStyle(COLS)}>
            <div className="dt-head" aria-hidden="true">
              <span>{t("admin.col.date")}</span><span>{t("admin.col.agent")}</span>
              <span className="dt-money">{t("admin.col.transactions")}</span><span className="dt-money">{t("admin.col.amountRwf")}</span><span>{t("admin.col.status")}</span>
            </div>
            {rows.map((r) => (
              <article key={r.id} className="dt-row">
                <span className="dt-cell" data-label={t("admin.col.date")}>{formatDate(`${r.payout_date}T12:00:00+02:00`, lang)}</span>
                <span className="dt-cell" data-label={t("admin.col.agent")}><strong>{r.agent_name}</strong></span>
                <span className="dt-cell dt-money" data-label={t("admin.col.transactions")}>{r.tx_count}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.amountRwf")}>{formatRwf(r.total_amount, lang)}</span>
                <span className="dt-cell" data-label={t("admin.col.status")}><span className="pill pill-ok">{t("status.paid")}</span></span>
              </article>
            ))}
          </div>
        )}
        {rows.length === 500 && <p className="footnote">{t("admin.tx.limit", { n: "500" })}</p>}
      </LoadGate>
    </>
  );
}
