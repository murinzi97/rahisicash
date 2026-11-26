import { useState } from "react";
import { changedRecently, showAccountNumber, toPayoutMethod, type PayoutMethod } from "../../lib/payoutMethod.ts";
import { supabase } from "../../lib/supabase.ts";
import { callFunction } from "../../lib/api.ts";
import { formatDate, kigaliToday } from "../../lib/dates.ts";
import { formatRwf } from "../../lib/money.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Modal } from "../../components/Modal.tsx";
import type { Key } from "../../i18n/en.ts";
import { Banner, Kv, LoadGate, colsStyle, errKey, useLoad } from "./ui.tsx";

interface Owed { agent_id: string; agent_name: string; tx_count: number; cash_given: number; commission: number; total: number }
const COLS = "2fr 1fr 1.2fr 1.4fr";

export default function DailyPayoutTab() {
  const { t, lang } = useI18n();
  const today = kigaliToday();
  const [day, setDay] = useState(today);
  const [review, setReview] = useState<Owed | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const list = useLoad(async () => {
    const { data, error } = await supabase.rpc("admin_payout_preview", { p_date: day });
    if (error) throw error;
    const owed = ((data ?? []) as Record<string, unknown>[]).map((r): Owed => ({
      agent_id: r.agent_id as string, agent_name: r.agent_name as string, tx_count: Number(r.tx_count),
      cash_given: Number(r.cash_given), commission: Number(r.commission), total: Number(r.total),
    }));
    // where each agent wants to be paid (a missing row just means "not set")
    const methods = new Map<string, PayoutMethod>();
    if (owed.length > 0) {
      const m = await supabase.from("payout_methods")
        .select("agent_id, method, provider, account_name, account_number, updated_at")
        .in("agent_id", owed.map((o) => o.agent_id));
      if (m.error) throw m.error;
      for (const r of (m.data ?? []) as Record<string, unknown>[]) methods.set(r.agent_id as string, toPayoutMethod(r));
    }
    return { owed, methods };
  }, [day]);

  const rows = list.data?.owed ?? [];
  const methods = list.data?.methods ?? new Map<string, PayoutMethod>();
  const totalTx = rows.reduce((a, r) => a + r.tx_count, 0);
  const totalOwed = rows.reduce((a, r) => a + r.total, 0);

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title">{t("admin.tab.dailyPayout")}</h1>
        <input className="input" style={{ width: "auto" }} type="date" aria-label={t("admin.payout.date")} value={day} max={today}
               onChange={(e) => e.target.value && setDay(e.target.value)} />
      </div>
      <p className="footnote">{t("admin.payout.hint")}</p>
      {banner && <Banner kind={banner.kind} text={banner.text} />}

      <LoadGate state={list.state} onRetry={list.reload} errorKey="admin.payout.error">
        {rows.length === 0 ? <p className="muted">{t("admin.payout.empty")}</p> : (
          <div className="dt" style={colsStyle(COLS)}>
            <div className="dt-head" aria-hidden="true">
              <span>{t("admin.col.agent")}</span><span className="dt-money">{t("admin.col.transactions")}</span>
              <span className="dt-money">{t("admin.col.owed")}</span><span />
            </div>
            {rows.map((r) => (
              <article key={r.agent_id} className="dt-row">
                <span className="dt-cell"><strong>{r.agent_name}</strong>
                  <span className="dt-sub">{methods.get(r.agent_id)
                    ? `${methods.get(r.agent_id)!.provider} · ${showAccountNumber(methods.get(r.agent_id)!)}`
                    : t("admin.payout.noMethodShort")}</span>
                </span>
                <span className="dt-cell dt-money" data-label={t("admin.col.transactions")}>{r.tx_count}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.owed")}>{formatRwf(r.total, lang)}</span>
                <span className="dt-actions"><button className="btn-sm" type="button" onClick={() => setReview(r)}>{t("admin.payout.review")}</button></span>
              </article>
            ))}
            <article className="dt-row dt-total">
              <span className="dt-cell">{t("common.total")}</span>
              <span className="dt-cell dt-money" data-label={t("admin.col.transactions")}>{totalTx}</span>
              <span className="dt-cell dt-money" data-label={t("admin.col.owed")}>{formatRwf(totalOwed, lang)}</span>
              <span className="dt-actions" />
            </article>
          </div>
        )}
      </LoadGate>

      {review && (
        <PayoutReview row={review} method={methods.get(review.agent_id) ?? null} day={day} onClose={() => setReview(null)}
          onResult={(r) => {
            setReview(null);
            setBanner(r.ok
              ? { kind: "ok", text: t("admin.payout.done", { amount: formatRwf(review.total, lang), agent: review.agent_name }) }
              : { kind: "bad", text: t(r.key) });
            list.reload();
          }} />
      )}
    </>
  );
}

function PayoutReview({ row, method, day, onClose, onResult }: {
  row: Owed; method: PayoutMethod | null; day: string; onClose: () => void;
  onResult: (r: { ok: true } | { ok: false; key: Key }) => void;
}) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyNumber() {
    if (!method) return;
    try {
      await navigator.clipboard.writeText(method.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the number is on screen: it can be copied by hand */ }
  }

  async function confirm() {
    setBusy(true);
    // expected_total is what this dialog showed: if anything changed, nothing is paid.
    const res = await callFunction("admin-money", { action: "create_payout", agent_id: row.agent_id, date: day, expected_total: row.total });
    setBusy(false);
    onResult(res.error ? { ok: false, key: errKey(res.error) } : { ok: true });
  }

  return (
    <Modal title={t("admin.payout.dialog")} onClose={busy ? () => undefined : onClose}>
      <Kv label={t("admin.payout.agent")} value={row.agent_name} />
      <Kv label={t("admin.payout.date")} value={formatDate(`${day}T12:00:00+02:00`, lang)} />
      <Kv label={t("admin.payout.transactions")} value={String(row.tx_count)} />
      <Kv label={t("admin.payout.cash")} value={formatRwf(row.cash_given, lang)} />
      <Kv label={t("admin.payout.commission")} value={formatRwf(row.commission, lang)} />
      <Kv label={t("admin.payout.toPay")} value={formatRwf(row.total, lang)} total />
      <div className="payout-dest">
        <strong>{t("admin.payout.payTo")}</strong>
        {method ? (
          <>
            <Kv label={t(method.method === "bank" ? "payout.method.bank" : "payout.method.momo")} value={method.provider} />
            <Kv label={t("payout.accountName")} value={method.account_name} />
            <Kv label={t(method.method === "bank" ? "payout.number.bank" : "payout.number.momo")} value={showAccountNumber(method)} />
            <button className="btn-sm btn-outline" type="button" onClick={() => void copyNumber()}>
              {t(copied ? "admin.payout.copied" : "admin.payout.copy")}
            </button>
            {changedRecently(method.updated_at) && <p className="modal-warn">{t("admin.payout.changedRecently")}</p>}
          </>
        ) : <p className="modal-warn">{t("admin.payout.noMethod")}</p>}
      </div>
      <p className="modal-warn">{t("admin.payout.warning")}</p>
      <div className="modal-actions">
        <button className="btn btn-outline" type="button" disabled={busy} onClick={onClose}>{t("common.cancel")}</button>
        <button className="btn" type="button" disabled={busy} onClick={() => void confirm()}>{t("admin.payout.confirm")}</button>
      </div>
    </Modal>
  );
}
