import { useState } from "react";
import { supabase } from "../../lib/supabase.ts";
import { callFunction } from "../../lib/api.ts";
import { formatDate } from "../../lib/dates.ts";
import { formatRwf } from "../../lib/money.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Modal } from "../../components/Modal.tsx";
import type { Key } from "../../i18n/en.ts";
import { Banner, Kv, LoadGate, errKey, useLoad } from "./ui.tsx";

interface Summary {
  balance: number; since: string | null; system_fees: number;
  pesapal_fees: number; unknown_fee_count: number; net_revenue: number | null;
}
const RESET_WORD = "RESET";

export default function BalanceTab() {
  const { t, lang } = useI18n();
  const [resetting, setResetting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "bad"; key: Key } | null>(null);

  const q = useLoad(async () => {
    const { data, error } = await supabase.rpc("admin_balance_summary");
    if (error) throw error;
    const r = (data as Record<string, unknown>[])[0];
    return {
      balance: Number(r.balance), since: (r.since as string | null) ?? null, system_fees: Number(r.system_fees),
      pesapal_fees: Number(r.pesapal_fees), unknown_fee_count: Number(r.unknown_fee_count),
      net_revenue: r.net_revenue === null ? null : Number(r.net_revenue),
    } as Summary;
  }, []);

  // What agents are owed and have been paid: for information, it does not change your balance.
  const agents = useLoad(async () => {
    const { data, error } = await supabase.from("agent_summary").select("balance_owed, total_paid");
    if (error) throw error;
    const rows = data as { balance_owed: number | string; total_paid: number | string }[];
    return {
      owed: rows.reduce((a, r) => a + Number(r.balance_owed), 0),
      paid: rows.reduce((a, r) => a + Number(r.total_paid), 0),
    };
  }, []);
  const s = q.data;
  const net = s?.net_revenue ?? null; // known once every payment has a Pesapal fee

  return (
    <>
      <h1 className="page-title">{t("admin.tab.balance")}</h1>
      {banner && <Banner kind={banner.kind} text={t(banner.key)} />}
      <LoadGate state={q.state} onRetry={q.reload} errorKey="admin.bal.error">
        {s && (
          <>
            <section className="balance-card">
              <p className="balance-label">{t(net === null ? "admin.bal.label" : "admin.bal.labelNet")}</p>
              <p className="balance-amount" style={{ margin: "12px 0 0" }}>{formatRwf(net === null ? s.balance : net, lang)}</p>
              {net !== null && (
                <p className="balance-sub">
                  {t("admin.bal.formula", { fees: formatRwf(s.system_fees, lang), pesapal: formatRwf(s.pesapal_fees, lang) })}
                </p>
              )}
            </section>
            <section className="card card-pad">
              <Kv label={t("admin.bal.systemFees")} value={formatRwf(s.system_fees, lang)} />
              <Kv label={t("admin.bal.pesapal")} value={s.unknown_fee_count > 0 ? "—" : formatRwf(-s.pesapal_fees, lang)} />
            </section>
            {s.unknown_fee_count > 0 && <p className="footnote">{t("admin.bal.unknown", { n: String(s.unknown_fee_count) })}</p>}
            {s.since && <p className="footnote">{t("admin.bal.since", { date: formatDate(s.since, lang) })}</p>}

            {agents.data && (
              <>
                <section className="card card-pad">
                  <Kv label={t("admin.bal.owedAgents")} value={formatRwf(agents.data.owed, lang)} />
                  <Kv label={t("admin.bal.paidAgents")} value={formatRwf(agents.data.paid, lang)} />
                </section>
                <p className="footnote">{t("admin.bal.agentNote")}</p>
              </>
            )}

            <button className="btn btn-outline btn-danger-outline btn-auto" style={{ alignSelf: "flex-start" }} type="button"
                    disabled={s.balance <= 0} onClick={() => setResetting(true)}>
              {t("admin.bal.reset")}
            </button>
          </>
        )}
      </LoadGate>

      {resetting && s && (
        <ResetModal balance={s.balance} onClose={() => setResetting(false)}
          onResult={(ok, key) => { setResetting(false); setBanner({ kind: ok ? "ok" : "bad", key }); q.reload(); }} />
      )}
    </>
  );
}

function ResetModal({ balance, onClose, onResult }: {
  balance: number; onClose: () => void; onResult: (ok: boolean, key: Key) => void;
}) {
  const { t, lang } = useI18n();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await callFunction("admin-money", { action: "reset_balance", confirm: RESET_WORD });
    setBusy(false);
    if (res.error) onResult(false, errKey(res.error)); else onResult(true, "admin.bal.resetDone");
  }

  return (
    <Modal title={t("admin.bal.resetTitle")} onClose={busy ? () => undefined : onClose}>
      <p className="subtle">{t("admin.bal.resetText", { amount: formatRwf(balance, lang) })}</p>
      <label className="label" htmlFor="reset-word">{t("admin.bal.resetType")}</label>
      <input id="reset-word" className="input" value={typed} placeholder={RESET_WORD} autoComplete="off"
             onChange={(e) => setTyped(e.target.value)} />
      <div className="modal-actions">
        <button className="btn btn-outline" type="button" disabled={busy} onClick={onClose}>{t("common.cancel")}</button>
        <button className="btn btn-danger-solid" type="button" disabled={busy || typed.trim() !== RESET_WORD} onClick={() => void submit()}>
          {t("admin.bal.resetSubmit")}
        </button>
      </div>
    </Modal>
  );
}
