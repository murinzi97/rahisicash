import { CONTACTS, displayPhone, telHref } from "../lib/contact.ts";
import { useI18n } from "../i18n/index.tsx";
import { InfoPage } from "../components/InfoPage.tsx";

function Team({ title, desc, phones, email }: { title: string; desc: string; phones: readonly string[]; email: string }) {
  const { t } = useI18n();
  return (
    <section className="card card-pad contact-card">
      <h2>{title}</h2>
      <p className="subtle">{desc}</p>
      {phones.map((p) => (
        <a key={p} className="contact-row" href={`tel:${telHref(p)}`}>
          <span>{t("contact.call")}</span><strong>{displayPhone(p)}</strong>
        </a>
      ))}
      <a className="contact-row" href={`mailto:${email}`}>
        <span>{t("contact.email")}</span><strong>{email}</strong>
      </a>
    </section>
  );
}

export default function Contact() {
  const { t } = useI18n();
  return (
    <InfoPage title={t("contact.title")}>
      <p className="subtle">{t("contact.intro")}</p>
      <Team title={t("contact.support.title")} desc={t("contact.support.desc")} {...CONTACTS.support} />
      <Team title={t("contact.sales.title")} desc={t("contact.sales.desc")} {...CONTACTS.sales} />
    </InfoPage>
  );
}
