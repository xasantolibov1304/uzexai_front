import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dict, valueLabels, statusHints } from "./dict";

const LangContext = createContext(null);
const KEY = "uzex_lang";
export const LANGS = [
  ["uz", "UZ"],
  ["ru", "RU"],
  ["en", "EN"],
];

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem(KEY);
    return saved && dict[saved] ? saved : "uz";
  });

  useEffect(() => {
    localStorage.setItem(KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // API qiymatini (ruscha) joriy tilda ko'rsatish
  const v = useCallback((value) => (value == null ? "—" : valueLabels[lang][value] ?? value), [lang]);
  const hint = useCallback((value) => statusHints[lang][value] ?? v(value), [lang, v]);

  const ctx = useMemo(() => ({ lang, setLang, t: dict[lang], v, hint }), [lang, v, hint]);
  return <LangContext.Provider value={ctx}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
