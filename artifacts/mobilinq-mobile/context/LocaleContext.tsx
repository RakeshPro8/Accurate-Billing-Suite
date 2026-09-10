import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  formatLocalizedCurrency,
  formatLocalizedDate,
  isLocale,
  setActiveLocale,
  t,
  translateText,
  type Locale,
} from "@workspace/localization";

type MobileLocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  translateText: (value: string) => string;
  formatDate: (value: string | Date | null | undefined) => string;
  formatCurrency: (value: number | null | undefined, currency?: string) => string;
  labels: typeof LOCALE_LABELS;
};

const LocaleContext = createContext<MobileLocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((saved) => {
      if (active && isLocale(saved)) setLocaleState(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setActiveLocale(locale);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = (next: Locale) => setLocaleState(next);
  const value = useMemo<MobileLocaleContextValue>(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale(locale === "en" ? "fr" : "en"),
    t: (key, values) => t(locale, key, values),
    translateText: (value) => translateText(locale, value),
    formatDate: (value) => formatLocalizedDate(value, locale),
    formatCurrency: (value, currency) => formatLocalizedCurrency(value, currency, locale),
    labels: LOCALE_LABELS,
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}