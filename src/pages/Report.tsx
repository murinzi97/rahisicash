import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { StatusPill } from "../components/StatusPill.tsx";
import { formatRwf } from "../lib/money.ts";
import { maskPhone } from "../lib/phone.ts";
import { formatDate, kigaliToday, monthStart, rangeBounds } from "../lib/dates.ts";
import { FILTER_STATUSES, type StatusFilter } from "../lib/transactions.ts";
import type { TxStatus } from "../lib/withdrawal.ts";
import type { Key } from "../i18n/en.ts";

interface Row { id: string; created_at: string; client_phone: string; amount: number; agent_commission: number; status: TxStatus }
const LIMIT = 500;
const FILTERS: [StatusFilter, Key][] = [["all", "report.all"], ["paid", "status.paid"], ["unpaid", "status.unpaid"], ["voided", "status.voided"]];

export default function Report() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const uid = session?.user.id;
  const today = kigaliToday();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    if (!uid || !from || !to) return;
    const { gte, lt } = rangeBounds(from, to);
    let q = supabase.from("transactions").select("id, created_at, client_phone, amount, agent_commission, status")
      .eq("agent_id", uid).gte("created_at", gte).lt("created_at", lt)
      .order("created_at", { ascending: false }).limit(LIMIT);
    const statuses = FILTER_STATUSES[filter];
    if (statuses) q = q.in("status", statuses);
    const { data, error } = await q;
    return { data, error };
  }, [uid, from, to, filter]);

  useEffect(() => {
    let stale = false;
    setState("loading");
    void load().then((r) => {
      if (stale || !r) return;
      if (r.error) { setState("error"); return; }
      setRows((r.data ?? []).map((x) => ({
        id: x.id as string, created_at: x.created_at as string, client_phone: x.client_phone as string,
        amount: Number(x.amount), agent_commission: Number(x.agent_commission), status: x.status as TxStatus,
      })));
      setState("ok");
    });
    return () => { stale = true; };
  }, [load, attempt]);

  // Keep the range valid: moving one date past the other drags the other with it.
  const pickFrom = (v: string) => { setFrom(v); if (v && to && v > to) setTo(v); };
  const pickTo = (v: string) => { setTo(v); if (v && from && v < from) setFrom(v); };

  return (
    <main className="screen center-col form-col">
      <h1 className="page-title align-left">{t("report.title")}</h1>

      <section className="card date-box">
        <input className="input" type="date" aria-label={t("report.from")} value={from} max={today} onChange={(e) => pickFrom(e.target.value)} />
        <span aria-hidden="true">–</span>
        <input className="input" type="date" aria-label={t("report.to")} value={to} max={today} onChange={(e) => pickTo(e.target.value)} />
      </section>

      <div className="chips" role="group" aria-label={t("report.title")}>
        {FILTERS.map(([f, key]) => (
          <button key={f} type="button" className={"chip" + (filter === f ? " is-on" : "")} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(key)}</button>
        ))}
      </div>

      {state === "loading" && <p className="muted">{t("common.loading")}</p>}
      {state === "error" && (
        <>
          <p className="error" role="alert">{t("report.error")}</p>
          <button className="btn btn-outline" type="button" onClick={() => setAttempt((n) => n + 1)}>{t("common.retry")}</button>
        </>
      )}
      {state === "ok" && rows.length === 0 && <p className="muted">{t("report.empty")}</p>}
      {state === "ok" && rows.map((r) => (
        <article key={r.id} className={"card report-row" + (r.status === "voided" ? " is-voided" : "")}>
          <div>
            <p className="report-date">{formatDate(r.created_at, lang)}</p>
            <p className="report-client">{t("pay.client", { phone: maskPhone(r.client_phone) })}</p>
            <p className="report-sub">{t("report.commission", { amount: formatRwf(r.agent_commission, lang) })}</p>
          </div>
          <div className="report-right">
            <strong className="report-amount">{formatRwf(r.amount, lang)}</strong>
            <StatusPill status={r.status} where="report" />
          </div>
        </article>
      ))}
      {state === "ok" && rows.length === LIMIT && <p className="muted">{t("report.limit", { n: String(LIMIT) })}</p>}

      <Link className="btn btn-outline btn-link" to="/agent">{t("pay.home")}</Link>
    </main>
  );
}
