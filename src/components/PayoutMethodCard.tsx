import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { formatDate } from "../lib/dates.ts";
import { showAccountNumber, toPayoutMethod, validatePayout, type PayoutKind, type PayoutMethod } from "../lib/payoutMethod.ts";
import type { Key } from "../i18n/en.ts";

type Load = "loading" | "error" | "ok";

/** Where the agent wants to be paid (bank or mobile money). Admins see this when paying. */
export function PayoutMethodCard() {
  const { t, lang } = useI18n();
  const { session, profile } = useAuth();
  const uid = session?.user.id ?? "";
  const [state, setState] = useState<Load>("loading");
  const [saved, setSaved] = useState<PayoutMethod | null>(null);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<PayoutKind>("mobile_money");
  const [provider, setProvider] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; key: Key } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let stale = false;
    supabase.from("payout_methods").select("method, provider, account_name, account_number, updated_at")
      .eq("agent_id", uid).maybeSingle()
      .then(({ data, error }) => {
        if (stale) return;
        if (error) { setState("error"); return; }
        setSaved(data ? toPayoutMethod(data as Record<string, unknown>) : null);
        setState("ok");
      });
    return () => { stale = true; };
  }, [uid]);

  function startEdit() {
    setKind(saved?.method ?? "mobile_money");
    setProvider(saved?.provider ?? "");
    setAccountName(saved?.account_name ?? profile?.full_name ?? "");
    setAccountNumber(saved?.account_number ?? "");
    setMsg(null);
    setEditing(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = validatePayout({ method: kind, provider, accountName, accountNumber });
    if (!v.ok) {
      const key: Key = v.field === "provider" ? "payout.error.provider"
        : v.field === "accountName" ? "payout.error.accountName"
        : kind === "mobile_money" ? "payout.error.numberMomo" : "payout.error.numberBank";
      return setMsg({ ok: false, key });
    }
    setBusy(true);
    setMsg(null);
    // update when a row exists, insert otherwise (the agent id can only be set on insert)
    const res = saved
      ? await supabase.from("payout_methods").update(v.value).eq("agent_id", uid).select("method, provider, account_name, account_number, updated_at").single()
      : await supabase.from("payout_methods").insert({ agent_id: uid, ...v.value }).select("method, provider, account_name, account_number, updated_at").single();
    setBusy(false);
    if (res.error || !res.data) return setMsg({ ok: false, key: "payout.error.save" });
    setSaved(toPayoutMethod(res.data as Record<string, unknown>));
    setEditing(false);
    setMsg({ ok: true, key: "payout.saved" });
  }

  const kindBtn = (k: PayoutKind, key: Key) => (
    <button type="button" className={"segmented-opt" + (kind === k ? " is-on" : "")} aria-pressed={kind === k}
            disabled={busy} onClick={() => setKind(k)}>{t(key)}</button>
  );
  const momo = kind === "mobile_money";

  return (
    <section className="card card-form">
      <h2 className="section-title">{t("payout.title")}</h2>
      <p className="subtle">{t("payout.hint")}</p>

      {state === "loading" && <p className="muted">{t("common.loading")}</p>}
      {state === "error" && <p className="error" role="alert">{t("payout.error.load")}</p>}

      {state === "ok" && !editing && (
        <>
          {saved ? (
            <>
              <div className="profile-row"><span className="muted">{t(saved.method === "bank" ? "payout.method.bank" : "payout.method.momo")}</span><strong>{saved.provider}</strong></div>
              <div className="profile-row"><span className="muted">{t("payout.accountName")}</span><strong>{saved.account_name}</strong></div>
              <div className="profile-row"><span className="muted">{t(saved.method === "bank" ? "payout.number.bank" : "payout.number.momo")}</span><strong>{showAccountNumber(saved)}</strong></div>
              <p className="footnote">{formatDate(saved.updated_at, lang)}</p>
            </>
          ) : <p className="muted">{t("payout.none")}</p>}
          {msg && <p className={msg.ok ? "notice" : "error"} role={msg.ok ? "status" : "alert"}>{t(msg.key)}</p>}
          <button className="btn btn-outline" type="button" onClick={startEdit}>{t(saved ? "payout.edit" : "payout.add")}</button>
        </>
      )}

      {state === "ok" && editing && (
        <form onSubmit={(e) => void submit(e)} noValidate style={{ display: "flex", flexDirection: "column" }}>
          <div className="segmented" role="group" aria-label={t("payout.title")}>
            {kindBtn("mobile_money", "payout.method.momo")}{kindBtn("bank", "payout.method.bank")}
          </div>
          <label className="label" htmlFor="po-provider">{t(momo ? "payout.provider.momo" : "payout.provider.bank")}</label>
          <input id="po-provider" className="input" list={momo ? "po-momo-list" : "po-bank-list"} value={provider} maxLength={60}
                 placeholder={t(momo ? "payout.providerPlaceholder.momo" : "payout.providerPlaceholder.bank")}
                 onChange={(e) => setProvider(e.target.value)} disabled={busy} />
          <datalist id="po-momo-list">
            <option value="MTN MoMo" /><option value="Airtel Money" /><option value="M-Pesa" /><option value="Orange Money" />
          </datalist>
          <datalist id="po-bank-list">
            <option value="Bank of Kigali" /><option value="Equity Bank" /><option value="I&M Bank" /><option value="Ecobank" />
            <option value="Access Bank" /><option value="BPR Bank" /><option value="Rawbank" /><option value="TMB" />
          </datalist>
          <label className="label" htmlFor="po-name">{t("payout.accountName")}</label>
          <input id="po-name" className="input" value={accountName} maxLength={120} autoComplete="name"
                 onChange={(e) => setAccountName(e.target.value)} disabled={busy} />
          <label className="label" htmlFor="po-number">{t(momo ? "payout.number.momo" : "payout.number.bank")}</label>
          <input id="po-number" className="input" value={accountNumber} maxLength={34} inputMode={momo ? "tel" : "text"}
                 onChange={(e) => setAccountNumber(e.target.value)} disabled={busy} />
          {msg && <p className={msg.ok ? "notice" : "error"} role={msg.ok ? "status" : "alert"}>{t(msg.key)}</p>}
          <button className="btn" type="submit" disabled={busy}>{t("payout.save")}</button>
          <button className="btn btn-outline" type="button" disabled={busy} onClick={() => { setEditing(false); setMsg(null); }}>{t("common.cancel")}</button>
        </form>
      )}
    </section>
  );
}
