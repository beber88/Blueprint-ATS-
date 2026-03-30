"use client";

import { Header } from "@/components/shared/header";
import { Mail, MessageCircle, Settings as SettingsIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[color:var(--bg-secondary)]" dir="rtl">
      <Header title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">{t("settings.title")}</h1>
          <p className="text-sm text-[color:var(--text-tertiary)] mt-1">{t("settings.subtitle")}</p>
        </div>

        {/* Integration Status */}
        <div className="rounded-xl shadow-sm border border-[color:var(--bg-tertiary)] overflow-hidden">
          <div className="p-5 border-b border-[color:var(--bg-tertiary)] flex items-center gap-3">
            <div className="w-10 h-10 bg-[color:var(--bg-tertiary)] rounded-xl flex items-center justify-center">
              <SettingsIcon className="h-5 w-5 text-[color:var(--text-secondary)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[color:var(--text-primary)]">{t("settings.integrations")}</h2>
              <p className="text-sm text-[color:var(--text-tertiary)]">{t("settings.integrations_subtitle")}</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[color:var(--bg-secondary)] border border-[color:var(--bg-tertiary)] hover:bg-[color:var(--bg-tertiary)]/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-[color:var(--bg-tertiary)]">
                  <Mail className="h-5 w-5 text-[color:var(--text-secondary)]" />
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--text-primary)]">{t("settings.gmail")}</p>
                  <p className="text-sm text-[color:var(--text-tertiary)]">{t("settings.gmail_desc")}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                process.env.NEXT_PUBLIC_GMAIL_CONFIGURED
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-[color:var(--bg-tertiary)] text-[color:var(--text-secondary)] border border-[color:var(--border-primary)]"
              }`}>
                {process.env.NEXT_PUBLIC_GMAIL_CONFIGURED ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {t("settings.env_config")}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[color:var(--bg-secondary)] border border-[color:var(--bg-tertiary)] hover:bg-[color:var(--bg-tertiary)]/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-[color:var(--bg-tertiary)]">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-[color:var(--text-primary)]">{t("settings.whatsapp")}</p>
                  <p className="text-sm text-[color:var(--text-tertiary)]">{t("settings.whatsapp_desc")}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[color:var(--bg-tertiary)] text-[color:var(--text-secondary)] border border-[color:var(--border-primary)]">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("settings.env_config")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
