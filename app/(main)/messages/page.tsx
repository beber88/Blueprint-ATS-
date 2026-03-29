"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Mail, MessageCircle, Clock, User, Search } from "lucide-react";
import { MessageTemplate } from "@/types";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";

export default function MessagesPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const [candidates, setCandidates] = useState<{id: string; full_name: string; email: string; phone: string}[]>([]);
  const [sentMessages, setSentMessages] = useState<{ id: string; candidateName: string; channel: string; subject: string; status: string; created_at: string }[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then(setTemplates)
      .catch(console.error);
    fetch("/api/candidates?limit=100")
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates || []))
      .catch(() => {});
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject || "");
      setBody(template.body);
      setChannel(template.type);
      // Extract variables
      const vars: Record<string, string> = {};
      const matches = template.body.match(/\{\{(\w+)\}\}/g) || [];
      matches.forEach((m) => {
        const key = m.replace(/[{}]/g, "");
        vars[key] = "";
      });
      if (template.subject) {
        const subMatches = template.subject.match(/\{\{(\w+)\}\}/g) || [];
        subMatches.forEach((m) => {
          const key = m.replace(/[{}]/g, "");
          vars[key] = "";
        });
      }
      // Auto-fill candidate name if a candidate is selected
      if (selectedCandidate) {
        const candidate = candidates.find((c) => c.id === selectedCandidate);
        if (candidate) {
          if ("שם_מועמד" in vars) vars["שם_מועמד"] = candidate.full_name;
          if ("candidate_name" in vars) vars["candidate_name"] = candidate.full_name;
        }
      }
      setVariables(vars);
    }
  };

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidate(candidateId);
    const candidate = candidates.find((c) => c.id === candidateId);
    if (candidate) {
      // Auto-fill variables with candidate info
      setVariables((prev) => {
        const updated = { ...prev };
        if ("שם_מועמד" in updated) updated["שם_מועמד"] = candidate.full_name;
        if ("candidate_name" in updated) updated["candidate_name"] = candidate.full_name;
        return updated;
      });
    }
  };

  const getPreview = () => {
    let preview = body;
    let previewSubject = subject;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      preview = preview.replace(regex, value || `{{${key}}}`);
      previewSubject = previewSubject.replace(regex, value || `{{${key}}}`);
    }
    return { body: preview, subject: previewSubject };
  };

  const handleSend = async () => {
    if (!selectedCandidate) {
      toast.error(t("messages.select_candidate"));
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: selectedCandidate,
          templateId: selectedTemplate || undefined,
          channel,
          variables,
          customSubject: selectedTemplate ? undefined : subject,
          customBody: selectedTemplate ? undefined : body,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success(t("messages.sent_success"));
      // Add to sent messages locally
      const candidate = candidates.find((c) => c.id === selectedCandidate);
      setSentMessages((prev) => [
        {
          id: Date.now().toString(),
          candidateName: candidate?.full_name || "",
          channel,
          subject: subject || `(${t("messages.no_subject")})`,
          status: "sent",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setComposeOpen(false);
      setSelectedCandidate("");
      setCandidateSearch("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("messages.send_error"));
    } finally {
      setSending(false);
    }
  };

  const preview = getPreview();

  const filteredCandidates = candidateSearch
    ? candidates.filter(
        (c) =>
          c.full_name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
          (c.email && c.email.toLowerCase().includes(candidateSearch.toLowerCase()))
      )
    : candidates;

  return (
    <div className="min-h-screen" style={{ background: 'var(--gray-50)' }} dir="rtl">
      {/* Page Header */}
      <div className="bg-white border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>{t("messages.title")}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{t("messages.subtitle")}</p>
          </div>
          <Button
            onClick={() => setComposeOpen(true)}
            className="rounded-lg text-white px-6 py-2.5"
            style={{ background: 'var(--blue)' }}
          >
            <Send className="ml-2 h-4 w-4" />
            {t("messages.new_message")}
          </Button>
        </div>
      </div>

      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Templates Section */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: 'var(--gray-100)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--blue-light)' }}>
              <Mail className="h-5 w-5" style={{ color: 'var(--blue)' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--navy)' }}>{t("templates.title")}</h2>
              <p className="text-sm" style={{ color: 'var(--gray-400)' }}>{templates.length} {t("messages.templates_count")}</p>
            </div>
          </div>
          <div className="p-5">
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--gray-100)' }}>
                  <Mail className="h-7 w-7" style={{ color: 'var(--gray-400)' }} />
                </div>
                <p className="font-medium" style={{ color: 'var(--gray-600)' }}>{t("messages.no_templates_yet")}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{t("messages.add_templates_hint")}</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow duration-200"
                    style={{ borderColor: 'var(--gray-100)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold" style={{ color: 'var(--navy)' }}>{template.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-lg font-medium" style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}>
                          {template.type === "email" ? (
                            <Mail className="h-3 w-3" />
                          ) : (
                            <MessageCircle className="h-3 w-3" />
                          )}
                          {template.type === "email" ? t("messages.channel.email") : "WhatsApp"}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-lg font-medium" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                          {template.category}
                        </span>
                      </div>
                    </div>
                    {template.subject && (
                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--gray-700)' }}>{template.subject}</p>
                    )}
                    <p className="text-sm line-clamp-3 leading-relaxed mb-4" style={{ color: 'var(--gray-500)' }}>
                      {template.body}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      style={{ borderColor: 'var(--gray-200)', color: 'var(--gray-700)' }}
                      onClick={() => {
                        handleTemplateSelect(template.id);
                        setComposeOpen(true);
                      }}
                    >
                      {t("messages.select_template")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sent Messages Section */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: 'var(--gray-100)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--blue-light)' }}>
              <Clock className="h-5 w-5" style={{ color: 'var(--blue)' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--navy)' }}>{t("messages.sent_section_title")}</h2>
              <p className="text-sm" style={{ color: 'var(--gray-400)' }}>{sentMessages.length} {t("messages.messages_count")}</p>
            </div>
          </div>
          <div className="p-5">
            {sentMessages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--gray-100)' }}>
                  <Send className="h-7 w-7" style={{ color: 'var(--gray-400)' }} />
                </div>
                <p className="font-medium" style={{ color: 'var(--gray-600)' }}>{t("messages.no_sent_yet")}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{t("messages.send_first_hint")}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--gray-200)' }}>
                    <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>{t("messages.table_candidate")}</th>
                    <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>{t("messages.table_channel")}</th>
                    <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>{t("messages.table_subject")}</th>
                    <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>{t("messages.table_date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sentMessages.map((msg, idx) => (
                    <tr key={String(msg.id || idx)} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--navy)' }}>{msg.candidateName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-lg font-medium" style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}>
                          {msg.channel === "email" ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                          {msg.channel === "email" ? t("messages.channel.email") : "WhatsApp"}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--gray-600)' }}>{msg.subject}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--gray-400)' }}>
                        {new Date(msg.created_at).toLocaleDateString("he-IL")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Compose Dialog */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b" style={{ borderColor: 'var(--gray-100)' }}>
              <DialogTitle className="text-xl font-bold" style={{ color: 'var(--navy)' }}>{t("messages.compose")}</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: 'var(--gray-700)' }}>{t("messages.select_candidate")}</Label>
                  <Select value={selectedCandidate} onValueChange={handleCandidateSelect}>
                    <SelectTrigger className="rounded-xl" style={{ borderColor: 'var(--gray-200)' }}>
                      <SelectValue placeholder={t("messages.select_candidate")} />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <div className="relative">
                          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--gray-400)' }} />
                          <Input
                            placeholder={t("messages.search_placeholder")}
                            value={candidateSearch}
                            onChange={(e) => setCandidateSearch(e.target.value)}
                            className="pr-8 h-8 text-sm rounded-lg"
                            style={{ borderColor: 'var(--gray-200)' }}
                          />
                        </div>
                      </div>
                      {filteredCandidates.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" style={{ color: 'var(--gray-400)' }} />
                            <span>{c.full_name}</span>
                            {c.email && <span className="text-xs" style={{ color: 'var(--gray-400)' }}>({c.email})</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: 'var(--gray-700)' }}>{t("messages.channel_label")}</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as "email" | "whatsapp")}>
                    <SelectTrigger className="rounded-xl" style={{ borderColor: 'var(--gray-200)' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">{t("messages.channel.email")}</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: 'var(--gray-700)' }}>{t("messages.template_optional")}</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="rounded-xl" style={{ borderColor: 'var(--gray-200)' }}>
                    <SelectValue placeholder={t("messages.select_template")} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.filter((t) => t.type === channel).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {Object.keys(variables).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: 'var(--gray-700)' }}>{t("messages.variables_label")}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(variables).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs" style={{ color: 'var(--gray-500)' }}>{key}</Label>
                        <Input
                          value={value}
                          onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                          placeholder={key}
                          className="rounded-xl"
                          style={{ borderColor: 'var(--gray-200)' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {channel === "email" && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: 'var(--gray-700)' }}>{t("messages.subject")}</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="rounded-xl"
                    style={{ borderColor: 'var(--gray-200)' }}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold" style={{ color: 'var(--gray-700)' }}>{t("messages.body")}</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="rounded-xl resize-none"
                  style={{ borderColor: 'var(--gray-200)' }}
                />
              </div>

              {/* Preview */}
              <div className="rounded-xl border p-4" style={{ background: 'var(--gray-50)', borderColor: 'var(--gray-100)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--gray-500)' }}>{t("messages.preview")}</p>
                {preview.subject && (
                  <p className="font-medium text-sm mb-1" style={{ color: 'var(--navy)' }}>{preview.subject}</p>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--gray-600)' }}>{preview.body}</p>
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t gap-2" style={{ borderColor: 'var(--gray-100)' }}>
              <Button variant="outline" onClick={() => setComposeOpen(false)} className="rounded-xl px-5">
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending}
                className="rounded-xl px-6 gap-2 text-white"
                style={{ background: 'var(--blue)' }}
              >
                <Send className="h-4 w-4" />
                {sending ? t("common.loading") : t("messages.send")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
