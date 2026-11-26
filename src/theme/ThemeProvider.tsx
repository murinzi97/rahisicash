import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY, parsePref, resolveTheme, type ThemeName, type ThemePref } from "../lib/theme.ts";

export type { ThemePref };

function readPref(): ThemePref {
  try { return parsePref(localStorage.getItem(THEME_STORAGE_KEY)); } catch { return "auto"; }
}

interface ThemeCtx { pref: ThemePref; resolved: ThemeName; setPref: (p: ThemePref) => void }
const Ctx = createContext<ThemeCtx | null>(null);

// index.html sets data-theme before the first paint (no flash). This keeps it in
// sync afterwards, follows the system in Auto mode, and colors the phone's status bar.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const resolved = resolveTheme(pref, systemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    // the status bar takes the page background of the active theme
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [resolved]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try { localStorage.setItem(THEME_STORAGE_KEY, p); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
