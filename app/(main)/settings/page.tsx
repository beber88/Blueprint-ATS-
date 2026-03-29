"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Mail, MessageCircle, Settings as SettingsIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { MessageTemplate } from "@/types";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";

export default function SettingsPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "email" as "email" | "whatsapp",
    category: "general" as MessageTemplate["category"],
    subject: "", body: "", variables: "",
  });

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates).catch(console.error);
  }, []);

  const handleCreateTemplate = async () => {
    if (!form.name || !form.body) {
      toast.error(t("common.error"));
      return;
    }
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          variables: form.variables ? form.variables.split(",").map((v) => v.trim()) : [],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("common.save"));
      setCreateOpen(false);
      setForm({ name: "", type: "email", category: "general", subject: "", body: "", variables: "" });
      const updated = await fetch("/api/templates").then((r) => r.json());
      setTemplates(updated);
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("settings.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("settings.subtitle")}</p>
        </div>

        {/* Integration Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <SettingsIcon className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t("settings.integrations")}</h2>
              <p className="text-sm text-gray-500">{t("settings.integrations_subtitle")}</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                  <Mail className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{t("settings.gmail")}</p>
                  <p className="text-sm text-gray-500">{t("settings.gmail_desc")}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                process.env.NEXT_PUBLIC_GMAIL_CONFIGURED
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}>
                {process.env.NEXT_PUBLIC_GMAIL_CONFIGURED ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {t("settings.env_config")}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                  <MessageCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{t("settings.whatsapp")}</p>
                  <p className="text-sm text-gray-500">{t("settings.whatsapp_desc")}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                <AlertCircle className="h-3.5 w-3.5" />
                {t("settings.env_config")}
              </span>
            </div>
          </div>
        </div>

        {/* Message Templates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t("templates.title")}</h2>
                <p className="text-sm text-gray-500">{t("templates.subtitle")}</p>
              </div>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-5 shadow-sm transition-colors"
            >
              <Plus className="ml-2 h-4 w-4" />
              {t("templates.new_template")}
            </Button>
          </div>
          <div className="p-5">
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">{t("templates.no_templates")}</p>
                <p className="text-sm text-gray-400 mt-1">{t("templates.no_templates_hint")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-start justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="font-semibold text-gray-900">{template.name}</p>
                        <span className="inline-flex items-center gap-1 text-xs bg-white text-gray-600 px-2.5 py-0.5 rounded-lg font-medium border border-gray-200">
                          {template.type === "email" ? (
                            <Mail className="h-3 w-3" />
                          ) : (
                            <MessageCircle className="h-3 w-3" />
                          )}
                          {template.type === "email" ? t("settings.gmail") : t("settings.whatsapp")}
                        </span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-lg font-medium">
                          {template.category}
                        </span>
                      </div>
                      {template.subject && (
                        <p className="text-sm text-gray-600 font-medium">{template.subject}</p>
                      )}
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1 leading-relaxed">{template.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create Template Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b border-gray-100">
              <DialogTitle className="text-xl font-bold text-gray-900">{t("templates.new_template")}</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">{t("templates.form.name")} *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="rounded-xl border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">{t("templates.form.channel")}</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "email" | "whatsapp" })}>
                    <SelectTrigger className="rounded-xl border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">{t("settings.gmail")}</SelectItem>
                      <SelectItem value="whatsapp">{t("settings.whatsapp")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">{t("templates.form.category")}</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as MessageTemplate["category"] })}>
                    <SelectTrigger className="rounded-xl border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interview_invite">{t("templates.categories.interview_invite")}</SelectItem>
                      <SelectItem value="rejection">{t("templates.categories.rejection")}</SelectItem>
                      <SelectItem value="next_stage">{t("templates.categories.next_stage")}</SelectItem>
                      <SelectItem value="offer">{t("templates.categories.offer")}</SelectItem>
                      <SelectItem value="general">{t("templates.categories.general")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.type === "email" && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">{t("messages.subject")}</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder={t("settings.variables_placeholder")}
                    className="rounded-xl border-gray-200"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">{t("messages.body")} *</Label>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={6}
                  placeholder={t("settings.body_placeholder")}
                  className="rounded-xl border-gray-200 resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">{t("templates.form.variables")}</Label>
                <Input
                  value={form.variables}
                  onChange={(e) => setForm({ ...form, variables: e.target.value })}
                  placeholder="candidate_name, job_title, interview_date"
                  className="rounded-xl border-gray-200"
                />
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t border-gray-100 gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl px-5">
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreateTemplate}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-6"
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
