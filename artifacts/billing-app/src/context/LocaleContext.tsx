import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  formatLocalizedCurrency,
  formatLocalizedDate,
  isLocale,
  t,
  translateText,
  type Locale,
} from "@workspace/localization";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  translateText: (text: string) => string;
  formatDate: (value: string | Date | null | undefined) => string;
  formatCurrency: (value: number | null | undefined, currency?: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const sourceTextByNode = new WeakMap<Text, string>();
const sourceAttributeByElement = new WeakMap<HTMLElement, Map<string, string>>();
const LOCALIZED_ATTRIBUTES = ["aria-label", "placeholder", "title", "alt"] as const;

function localizeNode(node: Node, locale: Locale) {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (!parent || parent.closest("[data-locale-ignore]")) return;
    const source = sourceTextByNode.get(textNode) ?? textNode.textContent ?? "";
    sourceTextByNode.set(textNode, source);
    const translated = translateText(locale, source);
    if (textNode.textContent !== translated) textNode.textContent = translated;
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as HTMLElement;
  if (element.closest("[data-locale-ignore]")) return;

  let attributes = sourceAttributeByElement.get(element);
  if (!attributes) {
    attributes = new Map();
    sourceAttributeByElement.set(element, attributes);
  }
  for (const attribute of LOCALIZED_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value === null) continue;
    const source = attributes.get(attribute) ?? value;
    attributes.set(attribute, source);
    const translated = translateText(locale, source);
    if (value !== translated) element.setAttribute(attribute, translated);
  }

  for (const child of Array.from(element.childNodes)) localizeNode(child, locale);
}

function localizeDocument(locale: Locale) {
  if (typeof document === "undefined") return;
  localizeNode(document.body, locale);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  });

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  };

  useEffect(() => {
    document.documentElement.lang = locale === "fr" ? "fr-CA" : "en-CA";
    localizeDocument(locale);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") localizeNode(record.target, locale);
        for (const node of Array.from(record.addedNodes)) localizeNode(node, locale);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale(locale === "en" ? "fr" : "en"),
    t: (key, values) => t(locale, key, values),
    translateText: (text) => translateText(locale, text),
    formatDate: (date) => formatLocalizedDate(date, locale),
    formatCurrency: (amount, currency) => formatLocalizedCurrency(amount, currency, locale),
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

export function useOptionalLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context) return context;
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => undefined,
    toggleLocale: () => undefined,
    t: (key, values) => t(DEFAULT_LOCALE, key, values),
    translateText: (text) => translateText(DEFAULT_LOCALE, text),
    formatDate: (date) => formatLocalizedDate(date, DEFAULT_LOCALE),
    formatCurrency: (amount, currency) => formatLocalizedCurrency(amount, currency, DEFAULT_LOCALE),
  };
}