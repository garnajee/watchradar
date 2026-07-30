import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { translate, type Translate } from "../lib/i18n";
import type { Locale } from "../types";

const LOCALE_STORAGE_KEY = "watchradar.locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function storedLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return value === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(storedLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The account preference remains authoritative when storage is unavailable.
    }
  }, []);

  const t = useCallback<Translate>(
    (key, params) => translate(locale, key, params),
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t("common.productName");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("meta.description"));
  }, [locale, t]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
