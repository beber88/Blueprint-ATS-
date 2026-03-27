"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Mail, MessageCircle, FileText } from "lucide-react";
import { MessageTemplate } from "@/types";
import { toast } from "sonner";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState("all");
  const [form, setForm] = useState({
    name: "", type: "email" as "email" | "whatsapp",
    category: "general" as MessageTemplate["category"],
    subject: "", body: "", variables: "",
  });

  useEffect(() => {
    fetch("/api/templates").then(r => r.json()).then(setTemplates).catch(console.error);
  }, []);

  const handleCreate = async () => {
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
          variables: form.variables ? form.variables.split(",").map(v => v.trim()) : [],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("התבנית נוצרה!");
      setCreateOpen(false);
      setForm({ name: "", type: "email", category: "general", subject: "", body: "", variables: "" });
      const updated = await fetch("/api/templates").then(r => r.json());
      setTemplates(updated);
    } catch {
      toast.error("שגיאה ביצירת תבנית");
    }
  };

  const categoryLabels: Record<string, string> = {
    interview_invite: "זימון ראיון",
    rejection: "דחייה",
    next_stage: "מעבר לשלב",
    offer: "הצעת עבודה",
    general: "כללי",
  };

  const filtered = templates.filter(t => channelFilter === "all" || t.type === channelFilter);

  return (
    <div className="min-h-screen" style={{ background: 'var(--gray-50)' }}>
      <div className="bg-white border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>תבניות הודעות</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{templates.length} תבניות</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="rounded-lg text-white" style={{ background: 'var(--blue)' }}>
            <Plus className="ml-2 h-4 w-4" /> תבנית חדשה
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Channel filter */}
        <div className="flex gap-2">
          {["all", "email", "whatsapp"].map(ch => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={channelFilter === ch ? { background: 'var(--blue)', color: '#fff' } : { background: 'var(--gray-100)', color: 'var(--gray-600)' }}
            >
              {ch === "all" ? "הכל" : ch === "email" ? "אימייל" : "WhatsApp"}
            </button>
          ))}
        </div>

        {/* Templates grid */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--gray-300)' }} />
            <p className="font-semibold text-lg" style={{ color: 'var(--navy)' }}>אין תבניות</p>
            <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>צרו תבנית ראשונה</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(template => (
              <div key={template.id} className="bg-white rounded-xl p-5 hover:shadow-md transition-shadow" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold" style={{ color: 'var(--navy)' }}>{template.name}</h3>
                  <div className="flex gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded" style={{ background: template.type === 'email' ? 'var(--blue-light)' : 'var(--green-light)', color: template.type === 'email' ? 'var(--blue)' : 'var(--green)' }}>
                      {template.type === 'email' ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                      {template.type === 'email' ? 'אימייל' : 'WhatsApp'}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                      {categoryLabels[template.category] || template.category}
                    </span>
                  </div>
                </div>
                {template.subject && <p className="text-sm font-medium mb-1" style={{ color: 'var(--gray-600)' }}>{template.subject}</p>}
                <p className="text-sm line-clamp-3" style={{ color: 'var(--gray-400)' }}>{template.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ color: 'var(--navy)' }}>תבנית חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">שם תבנית *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">ערוץ</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as "email" | "whatsapp" })}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">אימייל</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">קטגוריה</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v as MessageTemplate["category"] })}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interview_invite">זימון ראיון</SelectItem>
                    <SelectItem value="rejection">דחייה</SelectItem>
                    <SelectItem value="next_stage">מעבר לשלב</SelectItem>
                    <SelectItem value="offer">הצעת עבודה</SelectItem>
                    <SelectItem value="general">כללי</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "email" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">נושא</Label>
                <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="rounded-lg" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium">תוכן *</Label>
              <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={6} className="rounded-lg" placeholder="השתמשו ב-{{שם_מועמד}}, {{תפקיד}}, {{תאריך}}" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">משתנים (מופרדים בפסיקים)</Label>
              <Input value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })} className="rounded-lg" placeholder="שם_מועמד, תפקיד, תאריך" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg">ביטול</Button>
            <Button onClick={handleCreate} className="rounded-lg text-white" style={{ background: 'var(--blue)' }}>יצירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
