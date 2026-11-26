export type ThemePref = "light" | "night" | "auto";
export type ThemeName = "light" | "night";

export const THEME_STORAGE_KEY = "rahisi.theme";

export function parsePref(v: string | null): ThemePref {
  return v === "light" || v === "night" || v === "auto" ? v : "auto";
}

/** Auto follows the phone or computer; the other two are fixed. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): ThemeName {
  return pref === "auto" ? (systemDark ? "night" : "light") : pref;
}

/** Admin app bar button: Light -> Night -> Auto -> Light. */
export function nextPref(pref: ThemePref): ThemePref {
  return pref === "light" ? "night" : pref === "night" ? "auto" : "light";
}
