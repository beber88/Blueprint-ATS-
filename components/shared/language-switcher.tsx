"use client";

import { useI18n, Locale } from "@/lib/i18n/context";

const languages: { code: Locale; label: string; flag: string }[] = [
  { code: "he", label: "עב", flag: "🇮🇱" },
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "tl", label: "TL", flag: "🇵🇭" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 px-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLocale(lang.code)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={locale === lang.code ? {
            background: 'rgba(59,130,246,0.2)',
            color: '#fff',
          } : {
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <span>{lang.flag}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  );
}
