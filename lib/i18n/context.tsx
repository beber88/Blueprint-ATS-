"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import heMessages from "@/messages/he.json";
import enMessages from "@/messages/en.json";
import tlMessages from "@/messages/tl.json";

export type Locale = "he" | "en" | "tl";

const messages: Record<Locale, Record<string, unknown>> = {
  he: heMessages,
  en: enMessages,
  tl: tlMessages,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Return key as fallback
    }
  }
  return typeof current === "string" ? current : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("he");

  useEffect(() => {
    const saved = localStorage.getItem("blueprint-locale") as Locale;
    if (saved && ["he", "en", "tl"].includes(saved)) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("blueprint-locale", newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === "he" ? "rtl" : "ltr";
    document.body.style.fontFamily = newLocale === "he" ? "'Heebo', 'Inter', sans-serif" : "'Inter', 'Heebo', sans-serif";
  };

  const t = (key: string): string => {
    return getNestedValue(messages[locale] as Record<string, unknown>, key);
  };

  const dir = locale === "he" ? "rtl" : "ltr";

  // Set initial dir/lang
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.body.style.fontFamily = locale === "he" ? "'Heebo', 'Inter', sans-serif" : "'Inter', 'Heebo', sans-serif";
  }, [locale, dir]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
