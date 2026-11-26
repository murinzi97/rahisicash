import { supabase } from "../../lib/supabase.ts";
import { formatRwf } from "../../lib/money.ts";
import { useI18n } from "../../i18n/index.tsx";
import { LoadGate, colsStyle, useLoad } from "./ui.tsx";

interface Bal { agent_id: string; full_name: string; balance_owed: number; total_paid: number; transactions_in_balance: number }
const COLS = "2fr 1fr 1.2fr 1.2fr";

export default function BalancesTab() {
  const { t, lang } = useI18n();
  const list = useLoad(async () => {
    const { data, error } = await supabase.from("agent_summary")
      .select("agent_id, full_name, balance_owed, total_paid, transactions_in_balance")
      .order("balance_owed", { ascending: false });
    if (error) throw error;
    return (data as Record<string, unknown>[]).map((r): Bal => ({
      agent_id: r.agent_id as string, full_name: r.full_name as string, balance_owed: Number(r.balance_owed),
      total_paid: Number(r.total_paid), transactions_in_balance: Number(r.transactions_in_balance),
    })).filter((r) => r.balance_owed !== 0 || r.total_paid !== 0 || r.transactions_in_balance !== 0);
  }, []);
  const rows = list.data ?? [];

  return (
    <>
      <h1 className="page-title">{t("admin.tab.balances")}</h1>
      <LoadGate state={list.state} onRetry={list.reload} errorKey="admin.balances.error">
        {rows.length === 0 ? <p className="muted">{t("admin.balances.empty")}</p> : (
          <div className="dt" style={colsStyle(COLS)}>
            <div className="dt-head" aria-hidden="true">
              <span>{t("admin.col.agent")}</span><span className="dt-money">{t("admin.col.transactions")}</span>
              <span className="dt-money">{t("admin.col.owedNow")}</span><span className="dt-money">{t("admin.col.paidSoFar")}</span>
            </div>
            {rows.map((r) => (
              <article key={r.agent_id} className="dt-row">
                <span className="dt-cell"><strong>{r.full_name}</strong></span>
                <span className="dt-cell dt-money" data-label={t("admin.col.transactions")}>{r.transactions_in_balance}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.owedNow")}>{formatRwf(r.balance_owed, lang)}</span>
                <span className="dt-cell dt-money" data-label={t("admin.col.paidSoFar")}>{formatRwf(r.total_paid, lang)}</span>
              </article>
            ))}
          </div>
        )}
      </LoadGate>
    </>
  );
}
