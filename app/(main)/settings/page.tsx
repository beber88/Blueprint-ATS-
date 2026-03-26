"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { MessageTemplate } from "@/types";
import { toast } from "sonner";

export default function SettingsPage() {
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
      toast.error("שם ותוכן הם שדות חובה");
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
      toast.success("התבנית נוצרה!");
      setCreateOpen(false);
      setForm({ name: "", type: "email", category: "general", subject: "", body: "", variables: "" });
      const updated = await fetch("/api/templates").then((r) => r.json());
      setTemplates(updated);
    } catch {
      toast.error("יצירת התבנית נכשלה");
    }
  };

  return (
    <div>
      <Header title="הגדרות" subtitle="הגדרת אינטגרציות ותבניות" />
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Integration Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              אינטגרציות
            </CardTitle>
            <CardDescription>
              הגדרת חיבורים לשירותים חיצוניים
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Gmail</p>
                  <p className="text-sm text-muted-foreground">שליחת אימייל באמצעות OAuth2</p>
                </div>
              </div>
              <Badge variant={process.env.NEXT_PUBLIC_GMAIL_CONFIGURED ? "default" : "secondary"}>
                הגדרה ב-.env.local
              </Badge>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Twilio WhatsApp</p>
                  <p className="text-sm text-muted-foreground">WhatsApp Business API</p>
                </div>
              </div>
              <Badge variant="secondary">הגדרה ב-.env.local</Badge>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Message Templates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">תבניות הודעות</CardTitle>
                <CardDescription>יצירה וניהול תבניות הודעות</CardDescription>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                תבנית חדשה
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                אין תבניות עדיין
              </p>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="flex items-start justify-between p-4 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{template.name}</p>
                        <Badge variant="outline" className="text-xs">{template.type}</Badge>
                        <Badge variant="secondary" className="text-xs">{template.category}</Badge>
                      </div>
                      {template.subject && (
                        <p className="text-sm text-muted-foreground">{template.subject}</p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{template.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Template Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>יצירת תבנית הודעה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>שם תבנית *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>סוג</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "email" | "whatsapp" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">אימייל</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>קטגוריה</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as MessageTemplate["category"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interview_invite">הזמנה לראיון</SelectItem>
                      <SelectItem value="rejection">דחייה</SelectItem>
                      <SelectItem value="next_stage">שלב הבא</SelectItem>
                      <SelectItem value="offer">הצעה</SelectItem>
                      <SelectItem value="general">כללי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.type === "email" && (
                <div className="space-y-2">
                  <Label>נושא</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="השתמשו ב-{{variable_name}} למשתנים" />
                </div>
              )}
              <div className="space-y-2">
                <Label>תוכן *</Label>
                <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} placeholder="השתמשו ב-{{candidate_name}}, {{job_title}} וכו׳" />
              </div>
              <div className="space-y-2">
                <Label>משתנים (מופרדים בפסיקים)</Label>
                <Input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} placeholder="candidate_name, job_title, interview_date" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>ביטול</Button>
              <Button onClick={handleCreateTemplate}>יצירה</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
