import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { callFunction } from "../lib/api.ts";
import { useI18n } from "../i18n/index.tsx";
import { formatRwf, groupDigits } from "../lib/money.ts";
import { normalizeClientPhone } from "../lib/phone.ts";
import { MIN_AMOUNT, errorKeyFor, type CreatedPayment, type Quote } from "../lib/withdrawal.ts";
import type { Lang } from "../lib/types.ts";
import type { Key } from "../i18n/en.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
type Err = { key: Key; vars?: Record<string, string> };

export default function NewWithdrawal() {
  const { t, lang } = useI18n();
  const [amountText, setAmountText] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [clientLang, setClientLang] = useState<Lang>(lang);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<Err | null>(null);
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();
  // One random id per attempt: a double tap or a retry cannot create two payments.
  const requestId = useRef<string>(crypto.randomUUID());
  const amount = Number(amountText || 0);

  // Live fee preview. The fees are calculated on the server, never in this app.
  useEffect(() => {
    if (!amount || amount < MIN_AMOUNT) { setQuote(null); setQuoteState("idle"); return; }
    setQuoteState("loading");
    let stale = false;
    const timer = setTimeout(async () => {
      const r = await callFunction<{ quote: Quote }>("create-payment", { dry_run: true, amount });
      if (stale) return;
      if (r.data) { setQuote(r.data.quote); setQuoteState("ok"); } else { setQuote(null); setQuoteState("error"); }
    }, 400);
    return () => { stale = true; clearTimeout(timer); };
  }, [amount]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || amount < MIN_AMOUNT) return setError({ key: "withdraw.error.amount", vars: { min: formatRwf(MIN_AMOUNT, lang) } });
    if (name.trim().length < 2) return setError({ key: "withdraw.error.name" });
    const p = normalizeClientPhone(phone);
    if (!p) return setError({ key: "withdraw.error.phone" });
    if (email.trim() && !EMAIL.test(email.trim())) return setError({ key: "withdraw.error.email" });

    setWorking(true);
    const r = await callFunction<CreatedPayment>("create-payment", {
      request_id: requestId.current,
      amount,
      client_name: name.trim(),
      client_phone: p,
      client_email: email.trim() || null,
      client_language: clientLang,
    });
    setWorking(false);
    if (r.data === undefined) {
      requestId.current = crypto.randomUUID(); // a failed attempt must not be replayed
      setError({ key: errorKeyFor(r.error) });
      return;
    }
    navigate(`/agent/pay/${r.data.transaction_id}`, { replace: true });
  }

  const money = (n: number | undefined) => (quoteState === "ok" && quote && n !== undefined ? formatRwf(n, lang) : "…");
  const choice = (l: Lang) => (
    <button type="button" className={"choice" + (clientLang === l ? " is-on" : "")} aria-pressed={clientLang === l}
            onClick={() => setClientLang(l)}>
      {t(l === "en" ? "withdraw.lang.en" : "withdraw.lang.fr")}
    </button>
  );

  return (
    <form className="screen center-col form-col" onSubmit={submit} noValidate>
      <h1 className="page-title align-left">{t("withdraw.title")}</h1>
      <div className="card card-form">
        <label className="label" htmlFor="wa">{t("withdraw.amount")}</label>
        <input id="wa" className="input input-amount" inputMode="numeric" autoComplete="off" placeholder={groupDigits("10000", lang)}
               value={groupDigits(amountText, lang)}
               onChange={(e) => setAmountText(e.target.value.replace(/\D/g, "").slice(0, 9))} />
        <label className="label" htmlFor="wn">{t("withdraw.clientName")}</label>
        <input id="wn" className="input" autoComplete="off" placeholder={t("withdraw.clientNamePlaceholder")}
               value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label" htmlFor="wp">{t("withdraw.clientPhone")}</label>
        <input id="wp" className="input" type="tel" inputMode="tel" autoComplete="off"
               placeholder={t("withdraw.clientPhonePlaceholder")} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="label" htmlFor="we">{t("withdraw.clientEmail")}</label>
        <input id="we" className="input" type="email" inputMode="email" autoComplete="off"
               placeholder={t("withdraw.clientEmailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="label" id="wl">{t("withdraw.clientLang")}</div>
        <div className="choice-row" role="group" aria-labelledby="wl">{choice("en")}{choice("fr")}</div>
      </div>

      <section className="breakdown" aria-live="polite">
        <div className="breakdown-row"><span>{t("withdraw.cash")}</span><strong>{amount >= MIN_AMOUNT ? formatRwf(amount, lang) : "…"}</strong></div>
        <div className="breakdown-row"><span>{t("withdraw.fee")}</span><strong>{money(quote?.total_fee)}</strong></div>
        <div className="breakdown-row"><span>{t("withdraw.charged")}</span><strong>{money(quote?.total_paid)}</strong></div>
        <div className="breakdown-sep" />
        <div className="breakdown-row"><span>{t("withdraw.owed")}</span><strong>{money(quote?.agent_owed)}</strong></div>
      </section>
      {quoteState === "error" && <p className="error" role="alert">{t("withdraw.quoteError")}</p>}
      {error && <p className="error" role="alert">{t(error.key, error.vars)}</p>}

      <button className="btn" type="submit" disabled={working}>
        {working ? t("withdraw.submitting") : t("withdraw.submit")}
      </button>
      <Link className="btn btn-outline btn-link" to="/agent">{t("withdraw.back")}</Link>
    </form>
  );
}
