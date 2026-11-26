import { LegalLinks } from "../components/InfoPage.tsx";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.ts";
import { formatPhone } from "../lib/phone.ts";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { ThemeSwitch } from "../components/Controls.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { ChangePasswordCard } from "../components/ChangePasswordCard.tsx";
import { PayoutMethodCard } from "../components/PayoutMethodCard.tsx";
import type { Lang } from "../lib/types.ts";
import type { Key } from "../i18n/en.ts";

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const { profile, session, signOut } = useAuth();

  function chooseLang(l: Lang) {
    setLang(l);
    // Remember it on the account too (best effort: the device already remembers it).
    if (session) void supabase.from("profiles").update({ language: l }).eq("id", session.user.id);
  }

  const row = (label: Key, value: string) => (
    <div className="profile-row"><span className="muted">{t(label)}</span><strong>{value}</strong></div>
  );
  const langBtn = (l: Lang, key: Key) => (
    <button type="button" className={"segmented-opt" + (lang === l ? " is-on" : "")} aria-pressed={lang === l} onClick={() => chooseLang(l)}>{t(key)}</button>
  );

  return (
    <main className="screen center-col form-col">
      <div className="profile-head">
        <h1 className="page-title">{t("profile.title")}</h1>
        <Avatar path={profile?.avatar_path ?? null} name={profile?.full_name ?? ""} size={48} />
      </div>

      <section className="card card-form">
        {row("profile.name", profile?.full_name ?? "")}
        {row("profile.phone", formatPhone(profile?.phone ?? null))}
        {row("profile.email", session?.user.email ?? "")}
      </section>

      <section className="card card-form">
        <div className="label">{t("profile.language")}</div>
        <div className="segmented" role="group" aria-label={t("profile.language")}>{langBtn("en", "withdraw.lang.en")}{langBtn("fr", "withdraw.lang.fr")}</div>
        <div className="label">{t("theme.label")}</div>
        <ThemeSwitch />
      </section>

      <PayoutMethodCard />
      <ChangePasswordCard />

      <button className="btn btn-outline" type="button" onClick={() => void signOut()}>{t("common.logout")}</button>
      <Link className="btn btn-outline btn-link" to="/agent">{t("pay.home")}</Link>

    <LegalLinks />
    </main>
  );
}
