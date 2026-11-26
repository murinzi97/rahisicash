import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { StatusPill } from "../components/StatusPill.tsx";
import { formatRwf } from "../lib/money.ts";
import { maskPhone } from "../lib/phone.ts";
import { mailtoUrl, whatsappUrl } from "../lib/share.ts";
import type { TxStatus } from "../lib/withdrawal.ts";
import type { Lang } from "../lib/types.ts";

interface Tx {
  id: string; status: TxStatus; payment_link: string | null;
  client_name: string; client_phone: string; client_email: string | null; client_language: Lang;
  amount: number; agent_commission: number; total_paid: number;
}
const COLUMNS = "id, status, payment_link, client_name, client_phone, client_email, client_language, amount, agent_commission, total_paid";

/** The waiting page. Loads the transaction from the database, so it also works from "Pending orders". */
export default function PaymentPage() {
  const { id = "" } = useParams();
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tx, setTx] = useState<Tx | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound" | "error">("loading");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("transactions").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) { setState((cur) => (cur === "ok" ? cur : "error")); return; }
    if (!data) { setState("notfound"); return; }
    setTx({ ...(data as Tx), amount: Number(data.amount), agent_commission: Number(data.agent_commission), total_paid: Number(data.total_paid) });
    setState("ok");
  }, [id]);

  useEffect(() => { setState("loading"); void load(); }, [load]);

  // Live updates through Realtime (RLS: an agent only receives their own rows).
  useEffect(() => {
    const channel = supabase.channel(`tx-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${id}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, load]);

  // Backup in case the live connection drops: check every 6 seconds while waiting.
  const waiting = tx?.status === "pending";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => { void load(); }, 6000);
    return () => clearInterval(timer);
  }, [waiting, load]);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the link is on screen to copy by hand */ }
  }

  if (state === "loading") return <main className="screen center-col form-col"><p className="muted">{t("common.loading")}</p></main>;
  if (state === "notfound" || state === "error" || !tx) {
    return (
      <main className="screen center-col form-col">
        <h1 className="page-title align-left">{t("pay.title")}</h1>
        <p className="error" role="alert">{t(state === "notfound" ? "pay.notFound" : "pay.loadError")}</p>
        {state === "error" && <button className="btn btn-outline" type="button" onClick={() => { setState("loading"); void load(); }}>{t("common.retry")}</button>}
        <Link className="btn btn-outline btn-link" to="/agent">{t("pay.home")}</Link>
      </main>
    );
  }

  const agentName = profile?.full_name ?? "";
  const link = tx.payment_link;
  const share = link ? { ...tx, payment_link: link } : null;
  const mail = share ? mailtoUrl(share, agentName) : null;

  return (
    <main className="screen center-col form-col">
      <h1 className="page-title align-left">{t("pay.title")}</h1>

      {tx.status === "paid" ? (
        <>
          <section className="success-card">
            <span className="success-icon" aria-hidden="true">✓</span>
            <h2>{t("pay.paidTitle")}</h2>
            <p>{t("pay.paidText", { amount: formatRwf(tx.total_paid, lang) })}</p>
          </section>
          <p className="notice"><strong>{t("pay.confirmLead")}</strong> {t("pay.confirmRest", { amount: formatRwf(tx.amount, lang) })}</p>
          <section className="card owed-card">
            <span>{t("pay.addedToBalance")}</span>
            <strong>{formatRwf(tx.amount + tx.agent_commission, lang)}</strong>
          </section>
          <button className="btn" type="button" onClick={() => navigate("/agent", { replace: true })}>{t("pay.cashDone")}</button>
        </>
      ) : (
        <>
          <section className="card tx-card">
            <div className="tx-head">
              <div>
                <p className="tx-title">{t("pay.withdraw", { amount: formatRwf(tx.amount, lang) })}</p>
                <p className="tx-sub">{t("pay.client", { phone: maskPhone(tx.client_phone) })}</p>
              </div>
              <StatusPill status={tx.status} where="order" />
            </div>
            {waiting && <p className="subtle">{t("pay.waiting", { amount: formatRwf(tx.total_paid, lang) })}</p>}
          </section>

          {tx.status === "failed" && <p className="notice notice-bad">{t("pay.failed")}</p>}
          {tx.status === "expired" && <p className="notice notice-bad">{t("pay.expired")}</p>}
          {tx.status === "voided" && <p className="notice notice-bad">{t("pay.voided")}</p>}

          {waiting && !link && <p className="notice notice-bad">{t("pay.noLink")}</p>}
          {waiting && link && share && (
            <>
              <section className="card link-box">
                <div className="label">{t("pay.link")}</div>
                <p className="link-text">{link}</p>
              </section>
              <a className="btn btn-link" href={whatsappUrl(share, agentName)} target="_blank" rel="noopener noreferrer">{t("pay.whatsapp")}</a>
              {mail && <a className="btn btn-outline btn-link" href={mail}>{t("pay.email")}</a>}
              <button className="btn btn-outline" type="button" onClick={() => void copy(link)}>{copied ? t("pay.copied") : t("pay.copy")}</button>
              <p className="notice"><strong>{t("pay.hintLead")}</strong> {t("pay.hintRest")}</p>
            </>
          )}

          {!waiting && <Link className="btn btn-link" to="/agent/new">{t("pay.new")}</Link>}
          <Link className="btn btn-outline btn-link" to="/agent">{t("pay.home")}</Link>
        </>
      )}
    </main>
  );
}
