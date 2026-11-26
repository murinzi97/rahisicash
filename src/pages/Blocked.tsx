import { LegalLinks } from "../components/InfoPage.tsx";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { TopTools } from "../components/Controls.tsx";

export default function Blocked() {
  const { t } = useI18n();
  const { profile, signOut } = useAuth();
  const rejected = profile?.status === "rejected";

  return (
    <main className="screen center-col">
      <TopTools />
      <section className="card card-state">
        <span className="pill pill-bad">
          {rejected ? t("blocked.rejected") : t("blocked.suspended")}
        </span>
        <h1 className="state-title">{t("blocked.title")}</h1>
        <p className="subtle">
          {rejected ? t("blocked.rejectedText") : t("blocked.suspendedText")}
        </p>
      </section>
      <button className="btn btn-outline" type="button" onClick={() => void signOut()}>
        {t("common.logout")}
      </button>
      <div className="spacer" />
    <LegalLinks />
    </main>
  );
}
