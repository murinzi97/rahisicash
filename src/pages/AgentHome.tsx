import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { useOnline } from "../hooks/useOnline.ts";
import { Avatar } from "../components/Avatar.tsx";
import { LangSwitch } from "../components/Controls.tsx";
import { StatusPill } from "../components/StatusPill.tsx";
import { formatRwf } from "../lib/money.ts";
import { maskPhone } from "../lib/phone.ts";

interface Summary { balance: number; paid: number; count: number }
interface Order { id: string; amount: number; client_phone: string }

export default function AgentHome() {
  const { t, lang } = useI18n();
  const { profile, session, signOut } = useAuth();
  const online = useOnline();
  const uid = session?.user.id;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    if (!uid) return;
    // The balance comes from the ledger (agent_summary view); RLS shows an agent only their own row.
    const [s, o] = await Promise.all([
      supabase.from("agent_summary").select("balance_owed, total_paid, transactions_in_balance").eq("agent_id", uid).maybeSingle(),
      supabase.from("transactions").select("id, amount, client_phone")
        .eq("agent_id", uid).eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    ]);
    if (s.error || o.error) { setState((cur) => (cur === "ok" ? cur : "error")); return; }
    setSummary({
      balance: Number(s.data?.balance_owed ?? 0),
      paid: Number(s.data?.total_paid ?? 0),
      count: Number(s.data?.transactions_in_balance ?? 0),
    });
    setOrders((o.data ?? []).map((r) => ({ id: r.id as string, amount: Number(r.amount), client_phone: r.client_phone as string })));
    setState("ok");
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    void load();
    // A payment landing (or a new order) refreshes the screen by itself.
    const channel = supabase.channel(`home-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `agent_id=eq.${uid}` }, () => { void load(); })
      .subscribe();
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { void supabase.removeChannel(channel); document.removeEventListener("visibilitychange", onVisible); };
  }, [uid, load]);

  const money = (n: number | undefined) => (summary && n !== undefined ? formatRwf(n, lang) : "…");
  const countKey = summary?.count === 1 ? "home.txInBalance.one" : "home.txInBalance.other";

  return (
    <main className="screen center-col form-col">
      <header className="home-head">
        <Link className="home-id" to="/agent/profile" aria-label={t("home.profile")}>
          <Avatar path={profile?.avatar_path ?? null} name={profile?.full_name ?? ""} size={48} />
          <div>
            <h1 className="page-title">{t("agent.hello", { name: profile?.full_name ?? "" })}</h1>
            <p className="subtle home-sub">{t("agent.ready")}</p>
          </div>
        </Link>
        <span className={`pill ${online ? "pill-ok" : "pill-bad"}`}>{t(online ? "home.online" : "home.offline")}</span>
      </header>

      <section className="balance-card" aria-live="polite">
        <p className="balance-label">{t("home.balanceLabel")}</p>
        <p className="balance-amount">{money(summary?.balance)}</p>
        <div className="balance-line" />
        <div className="balance-foot">
          <span>{summary ? t(countKey, { count: String(summary.count) }) : "…"}</span>
          <span>{summary ? t("home.totalPaid", { amount: formatRwf(summary.paid, lang) }) : "…"}</span>
        </div>
      </section>

      <Link className="btn btn-link" to="/agent/new">{t("agent.newWithdrawal")}</Link>
      <Link className="btn btn-outline btn-link" to="/agent/report">{t("home.report")}</Link>

      <h2 className="section-title home-section">{t("home.pending")}</h2>
      {state === "error" && (
        <>
          <p className="error" role="alert">{t("home.loadError")}</p>
          <button className="btn btn-outline" type="button" onClick={() => { setState("loading"); void load(); }}>{t("common.retry")}</button>
        </>
      )}
      {state === "loading" && <p className="muted">{t("common.loading")}</p>}
      {state === "ok" && orders.length === 0 && <p className="muted">{t("home.noPending")}</p>}
      {state === "ok" && orders.map((o) => (
        <Link key={o.id} className="card order-card" to={`/agent/pay/${o.id}`}>
          <div>
            <p className="tx-title">{t("pay.withdraw", { amount: formatRwf(o.amount, lang) })}</p>
            <p className="tx-sub">{t("pay.client", { phone: maskPhone(o.client_phone) })}</p>
          </div>
          <StatusPill status="pending" where="order" />
        </Link>
      ))}

      <footer className="home-foot">
        <div className="home-foot-links">
          <Link className="link-bold" to="/agent/profile">{t("home.profileLink")}</Link>
          <button type="button" className="link-btn" onClick={() => void signOut()}>{t("common.logout")}</button>
        </div>
        <LangSwitch />
      </footer>
    </main>
  );
}
