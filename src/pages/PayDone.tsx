import { LegalLinks } from "../components/InfoPage.tsx";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/index.tsx";
import { LangSwitch } from "../components/Controls.tsx";

/**
 * PUBLIC page (no login): where Pesapal sends the client after paying or cancelling.
 * It deliberately claims nothing about the payment: the real result is confirmed
 * by the server (pesapal-ipn) and shown to the agent.
 */
export default function PayDone() {
  const { t, setLang } = useI18n();
  const [params] = useSearchParams();
  const cancelled = params.get("cancelled") === "1";

  // The agent chose the client's language for this withdrawal; it arrives in the link.
  useEffect(() => {
    const l = params.get("lang");
    if (l === "en" || l === "fr") setLang(l);
  }, [params, setLang]);

  return (
    <main className="screen center-col">
      <img className="logo" src="/logo.png" alt="" width={96} />
      <section className="card card-state">
        <h1 className="state-title">{t(cancelled ? "payDone.cancelledTitle" : "payDone.title")}</h1>
        <p className="subtle">{t(cancelled ? "payDone.cancelledText" : "payDone.text")}</p>
      </section>
      <LangSwitch />
    <LegalLinks />
    </main>
  );
}
