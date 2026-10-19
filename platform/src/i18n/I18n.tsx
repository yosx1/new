import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STRINGS } from './strings';
import type { Bilingual, Lang } from '../types';

interface I18nCtx {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Picks the right side of a bilingual field, falling back to the other language. */
  b: (v?: Bilingual | null) => string;
  fmtDate: (v?: { toDate(): Date } | Date | string | null, withTime?: boolean) => string;
}

const Ctx = createContext<I18nCtx>(null as unknown as I18nCtx);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch { /* storage unavailable */ }
  return navigator.language?.startsWith('en') ? 'en' : 'ar';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  }, []);

  const value = useMemo<I18nCtx>(() => {
    const idx = lang === 'en' ? 0 : 1;
    const t = (key: string, vars?: Record<string, string | number>) => {
      let s = STRINGS[key]?.[idx] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    };
    const b = (v?: Bilingual | null) => (v ? (lang === 'en' ? v.en || v.ar : v.ar || v.en) : '');
    const fmtDate: I18nCtx['fmtDate'] = (v, withTime) => {
      if (!v) return '—';
      const d = typeof v === 'string' ? new Date(v) : v instanceof Date ? v : v.toDate();
      if (isNaN(d.getTime())) return '—';
      const p = (n: number) => String(n).padStart(2, '0');
      const s = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      return withTime ? `${s} ${p(d.getHours())}:${p(d.getMinutes())}` : s;
    };
    return { lang, dir, setLang, t, b, fmtDate };
  }, [lang, dir, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
