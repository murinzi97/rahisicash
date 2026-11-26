import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/index.tsx";
import { LangSwitch } from "./Controls.tsx";

/** Frame for public information pages (Contact us, Privacy policy): works logged in or out. */
export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <main className="info-page">
      <header className="info-head">
        <Link to="/" className="info-brand" aria-label={t("app.name")}>
          <img src="/logo.png" alt="" width={36} height={36} />
          <strong>{t("app.name")}</strong>
        </Link>
        <LangSwitch />
      </header>
      <button type="button" className="back-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
        ← {t("common.back")}
      </button>
      <h1 className="page-title">{title}</h1>
      {children}
      <LegalLinks />
    </main>
  );
}

/** Small footer: Contact us · Privacy policy. */
export function LegalLinks() {
  const { t } = useI18n();
  return (
    <nav className="legal-links" aria-label={t("legal.nav")}>
      <Link to="/contact">{t("legal.contact")}</Link>
      <span aria-hidden="true">·</span>
      <Link to="/privacy">{t("legal.privacy")}</Link>
    </nav>
  );
}
