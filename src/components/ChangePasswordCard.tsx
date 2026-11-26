import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import type { Key } from "../i18n/en.ts";

/** Lets a signed-in agent change their own password. The current password is checked first. */
export function ChangePasswordCard() {
  const { t } = useI18n();
  const { session } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; key: Key } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const email = session?.user.email;
    if (!email) return;
    if (next.length < 8) return setMsg({ ok: false, key: "password.error.short" });
    if (next !== again) return setMsg({ ok: false, key: "password.error.mismatch" });
    if (next === current) return setMsg({ ok: false, key: "password.error.same" });

    setBusy(true);
    setMsg(null);
    // Prove it is really the agent (a phone left unlocked must not be enough to take over the account).
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setBusy(false);
      const wrong = /invalid login|invalid credentials/i.test(check.error.message);
      return setMsg({ ok: false, key: wrong ? "password.error.current" : "password.error.generic" });
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setMsg({ ok: false, key: "password.error.generic" });
    setCurrent(""); setNext(""); setAgain("");
    setMsg({ ok: true, key: "password.done" });
  }

  return (
    <form className="card card-form" onSubmit={(e) => void submit(e)} noValidate>
      <h2 className="section-title">{t("password.title")}</h2>
      <label className="label" htmlFor="pw-current">{t("password.current")}</label>
      <input id="pw-current" className="input" type="password" autoComplete="current-password" value={current}
             onChange={(e) => setCurrent(e.target.value)} disabled={busy} />
      <label className="label" htmlFor="pw-new">{t("password.new")}</label>
      <input id="pw-new" className="input" type="password" autoComplete="new-password" value={next}
             onChange={(e) => setNext(e.target.value)} disabled={busy} />
      <label className="label" htmlFor="pw-again">{t("password.again")}</label>
      <input id="pw-again" className="input" type="password" autoComplete="new-password" value={again}
             onChange={(e) => setAgain(e.target.value)} disabled={busy} />
      {msg && <p className={msg.ok ? "notice" : "error"} role={msg.ok ? "status" : "alert"}>{t(msg.key)}</p>}
      <button className="btn" type="submit" disabled={busy || !current || !next || !again}>{t("password.submit")}</button>
    </form>
  );
}
