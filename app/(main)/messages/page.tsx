"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Mail, MessageCircle } from "lucide-react";
import { MessageTemplate } from "@/types";
import { toast } from "sonner";

export default function MessagesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then(setTemplates)
      .catch(console.error);
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
      setVariables(vars);
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
    if (!candidateId) {
      toast.error("נא להזין מזהה מועמד/ת");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
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
      toast.success("ההודעה נשלחה!");
      setComposeOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "השליחה נכשלה");
    } finally {
      setSending(false);
    }
  };

  const preview = getPreview();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header title="הודעות" subtitle="שליחת הודעות למועמדים" />

      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">הודעות</h1>
            <p className="text-sm text-gray-500 mt-1">ניהול ושליחת הודעות למועמדים</p>
          </div>
          <Button
            onClick={() => setComposeOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-6 py-2.5 shadow-sm transition-colors"
          >
            <Send className="ml-2 h-4 w-4" />
            חיבור הודעה
          </Button>
        </div>

        {/* Templates Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">תבניות הודעות</h2>
              <p className="text-sm text-gray-500">{templates.length} תבניות זמינות</p>
            </div>
          </div>
          <div className="p-5">
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">אין תבניות עדיין</p>
                <p className="text-sm text-gray-400 mt-1">הוסיפו תבניות בהגדרות</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-gray-900">{template.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-lg font-medium">
                          {template.type === "email" ? (
                            <Mail className="h-3 w-3" />
                          ) : (
                            <MessageCircle className="h-3 w-3" />
                          )}
                          {template.type === "email" ? "אימייל" : "WhatsApp"}
                        </span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-lg font-medium">
                          {template.category}
                        </span>
                      </div>
                    </div>
                    {template.subject && (
                      <p className="text-sm font-medium text-gray-700 mb-1">{template.subject}</p>
                    )}
                    <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4">
                      {template.body}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg border-gray-200 text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        handleTemplateSelect(template.id);
                        setComposeOpen(true);
                      }}
                    >
                      שימוש בתבנית
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compose Dialog */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b border-gray-100">
              <DialogTitle className="text-xl font-bold text-gray-900">חיבור הודעה</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">מזהה מועמד/ת</Label>
                  <Input
                    value={candidateId}
                    onChange={(e) => setCandidateId(e.target.value)}
                    placeholder="הדביקו מזהה מועמד/ת"
                    className="rounded-xl border-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">ערוץ</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as "email" | "whatsapp")}>
                    <SelectTrigger className="rounded-xl border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">אימייל</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">תבנית (אופציונלי)</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="rounded-xl border-gray-200">
                    <SelectValue placeholder="בחרו תבנית" />
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
                  <Label className="text-sm font-semibold text-gray-700">משתנים</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(variables).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs text-gray-500">{key}</Label>
                        <Input
                          value={value}
                          onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                          placeholder={key}
                          className="rounded-xl border-gray-200"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {channel === "email" && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">נושא</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="rounded-xl border-gray-200"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">הודעה</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="rounded-xl border-gray-200 resize-none"
                />
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">תצוגה מקדימה</p>
                {preview.subject && (
                  <p className="font-medium text-sm text-gray-800 mb-1">{preview.subject}</p>
                )}
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{preview.body}</p>
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t border-gray-100 gap-2">
              <Button variant="outline" onClick={() => setComposeOpen(false)} className="rounded-xl px-5">
                ביטול
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-6 gap-2"
              >
                <Send className="h-4 w-4" />
                {sending ? "שולח..." : "שליחת הודעה"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
