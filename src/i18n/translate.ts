import { en, type Key } from "./en.ts";
import { fr } from "./fr.ts";
import type { Lang } from "../lib/types.ts";

const dictionaries: Record<Lang, Record<Key, string>> = { en, fr };

/** Translate into any language, regardless of the app's current language. */
export function translate(lang: Lang, key: Key, vars?: Record<string, string>): string {
  let s = dictionaries[lang][key] ?? en[key];
  // A function replacer keeps "$" in names or links from being read as a pattern.
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, () => v);
  return s;
}
