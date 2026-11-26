import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/index.tsx";
import { TopTools } from "../components/Controls.tsx";
import { ArtCard, ArtCoins, ArtLink } from "../components/WelcomeArt.tsx";
import { WELCOME_SLIDES, markWelcomed, stepSlide } from "../lib/welcome.ts";

const ART = [ArtCard, ArtLink, ArtCoins];
const TITLES = ["welcome.1.title", "welcome.2.title", "welcome.3.title"] as const;
const TEXTS = ["welcome.1.text", "welcome.2.text", "welcome.3.text"] as const;

/** Three short screens shown once, before the first login on a phone. */
export default function Welcome() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const last = i === WELCOME_SLIDES - 1;
  const Art = ART[i];

  function leave(to: "/login" | "/register") {
    markWelcomed();
    nav(to, { replace: true });
  }

  function onTouchEnd(x: number) {
    if (touchX.current === null) return;
    const dx = x - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 50) return;
    setI((v) => stepSlide(v, dx < 0 ? 1 : -1));
  }

  return (
    <main
      className="welcome"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
    >
      <div className="welcome-top">
        <div className="welcome-brand">
          <img src="/logo.png" alt="" width={44} />
          <span>Rahisi <span>Cash</span></span>
        </div>
        {!last && <button type="button" className="welcome-skip" onClick={() => leave("/login")}>{t("welcome.skip")}</button>}
      </div>
      <div className="welcome-tools"><TopTools /></div>

      <div className="welcome-art"><Art /></div>

      <div className="welcome-body" aria-live="polite">
        <h1>{t(TITLES[i])}</h1>
        <p>{t(TEXTS[i])}</p>
      </div>

      <div className="dots" role="img" aria-label={t("welcome.step", { n: String(i + 1), total: String(WELCOME_SLIDES) })}>
        {ART.map((_, k) => <span key={k} className={"dot" + (k === i ? " is-on" : "")} />)}
      </div>

      <div className="welcome-actions">
        {last ? (
          <>
            <button type="button" className="btn" onClick={() => leave("/login")}>{t("welcome.login")}</button>
            <button type="button" className="btn btn-outline" onClick={() => leave("/register")}>{t("login.register")}</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => setI((v) => stepSlide(v, 1))}>{t("welcome.next")}</button>
            <button type="button" className="btn btn-outline" onClick={() => leave("/login")}>{t("welcome.login")}</button>
          </>
        )}
      </div>
    </main>
  );
}
