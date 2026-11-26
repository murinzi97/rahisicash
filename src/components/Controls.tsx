import { useI18n } from "../i18n/index.tsx";
import { useTheme, type ThemePref } from "../theme/ThemeProvider.tsx";
import { nextPref } from "../lib/theme.ts";
import type { Lang } from "../lib/types.ts";

export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  const opt = (l: Lang, label: string) => (
    <button
      type="button"
      className={"lang-opt" + (lang === l ? " is-on" : "")}
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
    >
      {label}
    </button>
  );
  return (
    <div className="lang-switch" role="group" aria-label={t("lang.label")}>
      {opt("en", "EN")}
      <span aria-hidden="true">|</span>
      {opt("fr", "FR")}
    </div>
  );
}

/** Compact Light | Night pill for the start screens. Tapping picks that theme for good. */
export function ThemeToggle() {
  const { resolved, setPref } = useTheme();
  const { t } = useI18n();
  const opt = (v: "light" | "night", label: string) => (
    <button type="button" className={"pill-opt" + (resolved === v ? " is-on" : "")}
            aria-pressed={resolved === v} onClick={() => setPref(v)}>
      {label}
    </button>
  );
  return (
    <div className="pill-group" role="group" aria-label={t("theme.label")}>
      {opt("light", t("theme.light"))}
      {opt("night", t("theme.night"))}
    </div>
  );
}

/** EN | FR pill, same look as ThemeToggle. */
export function LangPills() {
  const { lang, setLang, t } = useI18n();
  const opt = (l: Lang, label: string) => (
    <button type="button" className={"pill-opt" + (lang === l ? " is-on" : "")}
            aria-pressed={lang === l} onClick={() => setLang(l)}>
      {label}
    </button>
  );
  return (
    <div className="pill-group" role="group" aria-label={t("lang.label")}>
      {opt("en", "EN")}
      {opt("fr", "FR")}
    </div>
  );
}

/** Theme and language, side by side, at the top of the start screens. */
export function TopTools() {
  return (
    <div className="top-tools">
      <ThemeToggle />
      <LangPills />
    </div>
  );
}

export function ThemeSwitch() {
  const { pref, setPref } = useTheme();
  const { t } = useI18n();
  const opts: [ThemePref, string][] = [
    ["light", t("theme.light")],
    ["night", t("theme.night")],
    ["auto", t("theme.auto")],
  ];
  return (
    <div className="segmented" role="group" aria-label={t("theme.label")}>
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={"segmented-opt" + (pref === v ? " is-on" : "")}
          onClick={() => setPref(v)}
          aria-pressed={pref === v}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Admin app bar: shows the current choice (Light, Night or Auto); each tap moves to the next. */
export function ThemeCycle() {
  const { pref, setPref } = useTheme();
  const { t } = useI18n();
  const label = t(`theme.${pref}` as const);
  return (
    <button type="button" className="theme-cycle" onClick={() => setPref(nextPref(pref))}
            aria-label={`${t("theme.label")}: ${label}`} title={t("theme.label")}>
      {label}
    </button>
  );
}

export function Splash() {
  const { t } = useI18n();
  return (
    <div className="screen center">
      <img className="logo splash-logo" src="/logo.png" alt="" width={96} />
      <p className="splash-word">Rahisi <span>Cash</span></p>
      <p className="muted">{t("common.loading")}</p>
    </div>
  );
}
