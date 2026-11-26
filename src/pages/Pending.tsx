import { LegalLinks } from "../components/InfoPage.tsx";
import { useEffect } from "react";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { TopTools } from "../components/Controls.tsx";
import { Avatar } from "../components/Avatar.tsx";

export default function Pending() {
  const { t } = useI18n();
  const { profile, refreshProfile, signOut } = useAuth();

  // Check every 20 seconds so the screen moves on by itself once approved.
  useEffect(() => {
    const id = setInterval(() => { void refreshProfile(); }, 20000);
    return () => clearInterval(id);
  }, [refreshProfile]);

  return (
    <main className="screen center-col">
      <TopTools />
      <section className="card card-state">
        <Avatar path={profile?.avatar_path ?? null} name={profile?.full_name ?? ""} size={88} />
        <br />
        <span className="pill pill-warn">{t("pending.badge")}</span>
        <h1 className="state-title">{t("pending.title")}</h1>
        <p className="subtle">{t("pending.text")}</p>
      </section>
      <button className="btn btn-outline" type="button" onClick={() => void refreshProfile()}>
        {t("pending.check")}
      </button>
      <button className="btn btn-outline" type="button" onClick={() => void signOut()}>
        {t("common.logout")}
      </button>
      <div className="spacer" />
    <LegalLinks />
    </main>
  );
}
