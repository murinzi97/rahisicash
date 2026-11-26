import { Link } from "react-router-dom";
import { CONTACTS, displayPhone } from "../lib/contact.ts";
import { useI18n } from "../i18n/index.tsx";
import type { Key } from "../i18n/en.ts";
import { InfoPage } from "../components/InfoPage.tsx";

// Each section: id, then how many paragraphs (p1, p2 ...) and bullets (b1, b2 ...) it has.
// The texts live in the translation files under privacy.<id>.p1 / .b1, so the typed keys below
// fail to compile if a text is missing.
const SECTIONS = [
  { id: "who", p: 2, b: 0 },
  { id: "collect", p: 1, b: 6 },
  { id: "use", p: 1, b: 6 },
  { id: "share", p: 2, b: 4 },
  { id: "law", p: 1, b: 0 },
  { id: "transfer", p: 1, b: 0 },
  { id: "keep", p: 1, b: 3 },
  { id: "rights", p: 2, b: 5 },
  { id: "security", p: 2, b: 4 },
  { id: "children", p: 1, b: 0 },
  { id: "device", p: 1, b: 0 },
  { id: "changes", p: 1, b: 0 },
  { id: "contact", p: 1, b: 0 },
] as const;

type Id = (typeof SECTIONS)[number]["id"];
const key = (id: Id, part: string) => `privacy.${id}.${part}` as Key;
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

export default function Privacy() {
  const { t } = useI18n();
  const vars = {
    email: CONTACTS.support.email,
    phone: displayPhone(CONTACTS.support.phones[0]),
    info: CONTACTS.sales.email,
  };
  return (
    <InfoPage title={t("privacy.title")}>
      <p className="muted">{t("privacy.updated")}</p>
      <article className="card card-pad policy">
        {SECTIONS.map((s) => (
          <section key={s.id}>
            <h2>{t(key(s.id, "title"))}</h2>
            {range(s.p).map((n) => n === 1 && s.b > 0 ? null : <p key={`p${n}`}>{t(key(s.id, `p${n}`), vars)}</p>)}
            {s.b > 0 && (
              <>
                <p>{t(key(s.id, "p1"), vars)}</p>
                <ul>{range(s.b).map((n) => <li key={n}>{t(key(s.id, `b${n}`), vars)}</li>)}</ul>
                {range(s.p).filter((n) => n > 1).map((n) => <p key={`p${n}`}>{t(key(s.id, `p${n}`), vars)}</p>)}
              </>
            )}
          </section>
        ))}
        <p><Link className="link-bold" to="/contact">{t("legal.contact")}</Link></p>
      </article>
    </InfoPage>
  );
}
