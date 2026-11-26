import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.ts";
import { callFunction } from "../../lib/api.ts";
import { fetchAll, searchFilter } from "../../lib/adminQuery.ts";
import { isoDate } from "../../lib/csv.ts";
import { exportTable, type ExportFormat } from "../../lib/exportFile.ts";
import { formatDate, kigaliToday, monthStart, rangeBounds } from "../../lib/dates.ts";
import { formatRwf } from "../../lib/money.ts";
import { formatPhone } from "../../lib/phone.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Modal } from "../../components/Modal.tsx";
import { StatusPill } from "../../components/StatusPill.tsx";
import type { TxStatus } from "../../lib/withdrawal.ts";
import type { Key } from "../../i18n/en.ts";
import { Banner, ExportMenu, LoadGate, colsStyle, errKey, useLoad } from "./ui.tsx";

interface TxRow {
  id: string; created_at: string; paid_at: string | null;
  client_name: string; client_phone: string;
  amount: number; commission_percent: number; system_fee_percent: number;
  agent_commission: number; system_fee: number; total_fee: number; total_paid: number;
  status: TxStatus; void_reason: string | null;
  agent_name: string; pesapal_fee: number | null;
}
interface Filters { q: string; from: string; to: string; agent: string; status: "" | TxStatus }
type Mode = "all" | "orders";

const SELECT = "id, created_at, paid_at, client_name, client_phone, amount, commission_percent, system_fee_percent, " +
  "agent_commission, system_fee, total_fee, total_paid, status, void_reason, " +
  "agent:profiles!agent_id(full_name), payment_details(pesapal_fee)";
const PAGE = 200;
const ORDER_STATUSES: TxStatus[] = ["pending", "failed", "expired"];
const ALL_STATUSES: TxStatus[] = ["pending", "paid", "failed", "expired", "voided"];
const STATUS_LABEL: Record<TxStatus, Key> = {
  pending: "status.waiting", paid: "status.paid", failed: "status.failed", expired: "status.expired", voided: "status.voided",
};
const COLS = "0.9fr 1.1fr 1.4fr 1fr 1fr 1fr 1fr 1.5fr";

function toRow(x: Record<string, unknown>): TxRow {
  const agent = x.agent as { full_name?: string } | null;
  const pd = x.payment_details as { pesapal_fee: number | null } | { pesapal_fee: number | null }[] | null;
  const fee = Array.isArray(pd) ? pd[0]?.pesapal_fee : pd?.pesapal_fee;
  return {
    id: x.id as string, created_at: x.created_at as string, paid_at: (x.paid_at as string | null) ?? null,
    client_name: x.client_name as string, client_phone: x.client_phone as string,
    amount: Number(x.amount), commission_percent: Number(x.commission_percent), system_fee_percent: Number(x.system_fee_percent),
    agent_commission: Number(x.agent_commission), system_fee: Number(x.system_fee),
    total_fee: Number(x.total_fee), total_paid: Number(x.total_paid),
    status: x.status as TxStatus, void_reason: (x.void_reason as string | null) ?? null,
    agent_name: agent?.full_name ?? "", pesapal_fee: fee === null || fee === undefined ? null : Number(fee),
  };
}

function build(f: Filters, mode: Mode) {
  const { gte, lt } = rangeBounds(f.from, f.to);
  let q = supabase.from("transactions").select(SELECT)
    .gte("created_at", gte).lt("created_at", lt).order("created_at", { ascending: false });
  if (f.agent) q = q.eq("agent_id", f.agent);
  const statuses = f.status ? [f.status] : mode === "orders" ? ORDER_STATUSES : null;
  if (statuses) q = q.in("status", statuses);
  const or = searchFilter(f.q);
  if (or) q = q.or(or);
  return q;
}

export default function TransactionsTab({ mode }: { mode: Mode }) {
  const { t, lang } = useI18n();
  const today = kigaliToday();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [agent, setAgent] = useState("");
  const [status, setStatus] = useState<"" | TxStatus>("");
  const [voiding, setVoiding] = useState<TxRow | null>(null);
  const [feeFor, setFeeFor] = useState<TxRow | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "bad"; key: Key } | null>(null);
  const [exporting, setExporting] = useState(false);

  // wait for the person to stop typing before searching
  useEffect(() => { const id = setTimeout(() => setQ(search), 350); return () => clearTimeout(id); }, [search]);

  const filters = useMemo<Filters>(() => ({ q, from, to, agent, status }), [q, from, to, agent, status]);

  const agents = useLoad(async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name").eq("role", "agent").order("full_name");
    if (error) throw error;
    return data as { id: string; full_name: string }[];
  }, []);

  const list = useLoad(async () => {
    const { data, error } = await build(filters, mode).limit(PAGE);
    if (error) throw error;
    return (data as unknown as Record<string, unknown>[]).map(toRow);
  }, [filters, mode]);

  const pickFrom = (v: string) => { setFrom(v); if (v && to && v > to) setTo(v); };
  const pickTo = (v: string) => { setTo(v); if (v && from && v < from) setFrom(v); };

  async function runExport(format: ExportFormat) {
    setExporting(true);
    setBanner(null);
    try {
      const rows = (await fetchAll<Record<string, unknown>>((a, b) => build(filters, mode).range(a, b))).map(toRow);
      const headers = [
        "ID", t("csv.createdAt"), t("csv.paidAt"), t("admin.col.agent"), t("admin.col.client"), t("csv.clientPhone"),
        t("admin.col.amount"), t("csv.commissionPct"), t("csv.systemFeePct"), t("admin.col.commission"), t("admin.col.systemFee"),
        t("csv.totalFee"), t("csv.totalPaid"), t("csv.pesapalFee"), t("admin.col.status"), t("csv.voidReason"),
      ];
      const body = rows.map((r) => [
        r.id, isoDate(r.created_at), isoDate(r.paid_at), r.agent_name, r.client_name, formatPhone(r.client_phone),
        r.amount, r.commission_percent, r.system_fee_percent, r.agent_commission, r.system_fee,
        r.total_fee, r.total_paid, r.pesapal_fee, r.status, r.void_reason,
      ]);
      const name = `${mode === "orders" ? "orders" : "transactions"}-${from}_${to}`;
      exportTable({
        format, filename: name, lang,
        title: t(mode === "orders" ? "admin.tab.orders" : "admin.tab.transactions"),
        subtitle: t("export.subtitle", { from, to, n: String(rows.length) }),
        csvHeaders: headers, csvRows: body,
        pdfHeaders: [t("admin.col.date"), t("admin.col.agent"), t("admin.col.client"), t("csv.clientPhone"), t("admin.col.amount"),
                     t("admin.col.commission"), t("admin.col.systemFee"), t("csv.totalPaid"), t("admin.col.status")],
        pdfRows: rows.map((r) => [
          formatDate(r.created_at, lang), r.agent_name, r.client_name, formatPhone(r.client_phone), formatRwf(r.amount, lang),
          formatRwf(r.agent_commission, lang), formatRwf(r.system_fee, lang), formatRwf(r.total_paid, lang), t(STATUS_LABEL[r.status]),
        ]),
        pdfAlign: ["l", "l", "l", "l", "r", "r", "r", "r", "l"],
        footerLeft: t("export.generated", { date: formatDate(new Date().toISOString(), lang) }),
        pageLabel: (n, m) => t("export.page", { n: String(n), m: String(m) }),
      });
    } catch {
      setBanner({ kind: "bad", key: "csv.error" });
    }
    setExporting(false);
  }

  const statusOptions = mode === "orders" ? ORDER_STATUSES : ALL_STATUSES;
  const rows = list.data ?? [];

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">{t(mode === "orders" ? "admin.tab.orders" : "admin.tab.transactions")}</h1>
        <ExportMenu disabled={exporting || list.state !== "ok" || rows.length === 0} onPick={(f) => void runExport(f)} />
      </div>
      {mode === "orders" && <p className="footnote">{t("admin.orders.hint")}</p>}
      <p className="footnote">{t("admin.export.note")}</p>

      <div className="filters">
        <input className="input input-search" type="search" placeholder={t("admin.filter.search")} aria-label={t("admin.filter.search")}
               value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input" type="date" aria-label={t("report.from")} value={from} max={today} onChange={(e) => pickFrom(e.target.value)} />
        <input className="input" type="date" aria-label={t("report.to")} value={to} max={today} onChange={(e) => pickTo(e.target.value)} />
        <select className="input" aria-label={t("admin.filter.allAgents")} value={agent} onChange={(e) => setAgent(e.target.value)}>
          <option value="">{t("admin.filter.allAgents")}</option>
          {(agents.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <select className="input" aria-label={t("admin.filter.allStatuses")} value={status} onChange={(e) => setStatus(e.target.value as "" | TxStatus)}>
          <option value="">{t("admin.filter.allStatuses")}</option>
          {statusOptions.map((s) => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}
        </select>
      </div>

      {banner && <Banner kind={banner.kind} text={t(banner.key)} />}

      <LoadGate state={list.state} onRetry={list.reload} errorKey="admin.tx.error">
        {rows.length === 0 ? <p className="muted">{t("admin.tx.empty")}</p> : (
          <div className="dt" style={colsStyle(COLS)}>
            <div className="dt-head" aria-hidden="true">
              <span>{t("admin.col.date")}</span><span>{t("admin.col.agent")}</span><span>{t("admin.col.client")}</span>
              <span className="dt-money">{t("admin.col.amount")}</span><span className="dt-money">{t("admin.col.commission")}</span>
              <span className="dt-money">{t("admin.col.systemFee")}</span><span>{t("admin.col.status")}</span><span />
            </div>
            {rows.map((r) => (
              <article key={r.id} className={"dt-row" + (r.status === "voided" ? " is-voided" : "")}>
                <span className="dt-cell" data-label={t("admin.col.date")}>{formatDate(r.created_at, lang)}</span>
                <span className="dt-cell" data-label={t("admin.col.agent")}>{r.agent_name}</span>
                <span className="dt-cell" data-label={t("admin.col.client")}>{r.client_name}<span className="dt-sub">{formatPhone(r.client_phone)}</span></span>
                <span className="dt-cell dt-money" data-label={t("admin.col.amount")}>{formatRwf(r.amount, lang)}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.commission")}>{formatRwf(r.agent_commission, lang)}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.systemFee")}>{formatRwf(r.system_fee, lang)}</span>
                <span className="dt-cell" data-label={t("admin.col.status")}><StatusPill status={r.status} where="order" /></span>
                <span className="dt-actions">
                  {r.status === "paid" && <button className="btn-sm btn-outline" type="button" onClick={() => setFeeFor(r)}>{t("admin.tx.pesapalFee")}</button>}
                  {r.status !== "voided" && <button className="btn-sm btn-danger" type="button" onClick={() => setVoiding(r)}>{t("admin.tx.void")}</button>}
                </span>
              </article>
            ))}
          </div>
        )}
        {rows.length === PAGE && <p className="footnote">{t("admin.tx.limit", { n: String(PAGE) })}</p>}
      </LoadGate>

      {voiding && (
        <VoidModal tx={voiding} onClose={() => setVoiding(null)}
                   onDone={() => { setVoiding(null); setBanner({ kind: "ok", key: "admin.void.done" }); list.reload(); }} />
      )}
      {feeFor && (
        <PesapalFeeModal tx={feeFor} onClose={() => setFeeFor(null)}
                         onDone={() => { setFeeFor(null); setBanner({ kind: "ok", key: "admin.pfee.done" }); list.reload(); }} />
      )}
    </>
  );
}

function VoidModal({ tx, onClose, onDone }: { tx: TxRow; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Key | null>(null);
  const valid = reason.trim().length >= 3;

  async function submit() {
    if (!valid) { setError("admin.void.reasonError"); return; }
    setBusy(true);
    setError(null);
    const res = await callFunction("admin-money", { action: "void_transaction", transaction_id: tx.id, reason: reason.trim() });
    setBusy(false);
    if (res.error) setError(errKey(res.error)); else onDone();
  }

  const vars = { amount: formatRwf(tx.amount, lang), agent: tx.agent_name, date: formatDate(tx.created_at, lang) };
  return (
    <Modal title={t("admin.void.title")} onClose={busy ? () => undefined : onClose}>
      <p className="subtle">{t(tx.status === "paid" ? "admin.void.textPaid" : "admin.void.textUnpaid", vars)}</p>
      <label className="label" htmlFor="void-reason">{t("admin.void.reason")}</label>
      <input id="void-reason" className="input" value={reason} maxLength={300} placeholder={t("admin.void.reasonPlaceholder")}
             onChange={(e) => setReason(e.target.value)} />
      {error && <p className="error" role="alert">{t(error)}</p>}
      <div className="modal-actions">
        <button className="btn btn-outline" type="button" disabled={busy} onClick={onClose}>{t("admin.void.keep")}</button>
        <button className="btn btn-danger-solid" type="button" disabled={busy || !valid} onClick={() => void submit()}>{t("admin.void.submit")}</button>
      </div>
    </Modal>
  );
}

function PesapalFeeModal({ tx, onClose, onDone }: { tx: TxRow; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const [value, setValue] = useState(tx.pesapal_fee === null ? "" : String(tx.pesapal_fee));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Key | null>(null);

  async function submit() {
    const s = value.trim().replace(",", ".");
    let fee: number | null = null;
    if (s !== "") {
      if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) { setError("admin.pfee.invalid"); return; }
      fee = Number(s);
    }
    setBusy(true);
    setError(null);
    const res = await callFunction("admin-money", { action: "set_pesapal_fee", transaction_id: tx.id, fee });
    setBusy(false);
    if (res.error) setError(errKey(res.error)); else onDone();
  }

  return (
    <Modal title={t("admin.pfee.title")} onClose={busy ? () => undefined : onClose}>
      <p className="subtle">{formatRwf(tx.total_paid, lang)} · {tx.agent_name} · {formatDate(tx.created_at, lang)}</p>
      <p className="subtle">{t("admin.pfee.text")}</p>
      <label className="label" htmlFor="pfee">{t("admin.pfee.label")}</label>
      <input id="pfee" className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      {error && <p className="error" role="alert">{t(error)}</p>}
      <div className="modal-actions">
        <button className="btn btn-outline" type="button" disabled={busy} onClick={onClose}>{t("common.cancel")}</button>
        <button className="btn" type="button" disabled={busy} onClick={() => void submit()}>{t("common.save")}</button>
      </div>
    </Modal>
  );
}
