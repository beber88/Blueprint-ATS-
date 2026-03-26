"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div>
      <Header title="הודעות" subtitle="שליחת הודעות למועמדים" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setComposeOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            חיבור הודעה
          </Button>
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">תבניות</TabsTrigger>
          </TabsList>
          <TabsContent value="templates" className="space-y-4">
            {templates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  אין תבניות עדיין. הוסיפו תבניות בהגדרות.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {template.type === "email" ? <Mail className="h-3 w-3 mr-1" /> : <MessageCircle className="h-3 w-3 mr-1" />}
                            {template.type}
                          </Badge>
                          <Badge variant="secondary">{template.category}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {template.subject && (
                        <p className="text-sm font-medium mb-1">{template.subject}</p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {template.body}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          handleTemplateSelect(template.id);
                          setComposeOpen(true);
                        }}
                      >
                        שימוש בתבנית
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Compose Dialog */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>חיבור הודעה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>מזהה מועמד/ת</Label>
                  <Input value={candidateId} onChange={(e) => setCandidateId(e.target.value)} placeholder="הדביקו מזהה מועמד/ת" />
                </div>
                <div className="space-y-2">
                  <Label>ערוץ</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as "email" | "whatsapp")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">אימייל</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>תבנית (אופציונלי)</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger><SelectValue placeholder="בחרו תבנית" /></SelectTrigger>
                  <SelectContent>
                    {templates.filter((t) => t.type === channel).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {Object.keys(variables).length > 0 && (
                <div className="space-y-2">
                  <Label>משתנים</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(variables).map(([key, value]) => (
                      <div key={key}>
                        <Label className="text-xs">{key}</Label>
                        <Input
                          value={value}
                          onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                          placeholder={key}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {channel === "email" && (
                <div className="space-y-2">
                  <Label>נושא</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <Label>הודעה</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">תצוגה מקדימה</p>
                {preview.subject && <p className="font-medium text-sm mb-1">{preview.subject}</p>}
                <p className="text-sm whitespace-pre-wrap">{preview.body}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposeOpen(false)}>ביטול</Button>
              <Button onClick={handleSend} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "שולח..." : "שליחת הודעה"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
