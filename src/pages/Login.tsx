import { LegalLinks } from "../components/InfoPage.tsx";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { TopTools } from "../components/Controls.tsx";

export default function Login() {
  const { t } = useI18n();
  const { session, profileFailed, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    // The same message for "no such user" and "wrong password" on purpose.
    if (err) setError(err.status === 400 ? t("login.error.invalid") : t("login.error.generic"));
    // On success the AuthProvider loads the profile and the router moves on.
  }

  return (
    <main className="screen center-col">
      <TopTools />
      <img className="logo" src="/logo.png" alt={t("app.name")} width={128} />
      <h1 className="wordmark">RAHISI <span>CASH</span></h1>
      <p className="tagline">{t("login.tagline")}</p>

      <form className="card card-login" onSubmit={submit} noValidate>
        <label className="label" htmlFor="email">{t("login.email")}</label>
        <input
          id="email" className="input" type="email" autoComplete="email"
          inputMode="email" placeholder={t("login.emailPlaceholder")}
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <label className="label" htmlFor="password">{t("login.password")}</label>
        <input
          id="password" className="input" type="password" autoComplete="current-password"
          placeholder={t("login.passwordPlaceholder")}
          value={password} onChange={(e) => setPassword(e.target.value)} required
        />

        {error && <p className="error" role="alert">{error}</p>}
        {session && profileFailed && (
          <p className="error" role="alert">
            {t("login.error.profile")}{" "}
            <button type="button" className="link-btn" onClick={signOut}>{t("common.logout")}</button>
          </p>
        )}

        <button className="btn" type="submit" disabled={busy || !email || !password}>
          {busy ? t("login.submitting") : t("login.submit")}
        </button>
        <p className="center-text muted">
          {t("login.newAgent")}{" "}
          <Link className="link-bold" to="/register">{t("login.register")}</Link>
        </p>
      </form>

      <div className="spacer" />
    <LegalLinks />
    </main>
  );
}
