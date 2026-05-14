"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Plus, Mail, MessageCircle, FileText, Pencil, Trash2 } from "lucide-react";
import { MessageTemplate } from "@/types";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";

export default function TemplatesPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState("all");
  const [form, setForm] = useState({
    name: "", type: "email" as "email" | "whatsapp",
    category: "general" as MessageTemplate["category"],
    subject: "", body: "", variables: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", type: "email" as "email" | "whatsapp",
    category: "general" as MessageTemplate["category"],
    subject: "", body: "", variables: "",
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchTemplates = () => {
    fetch("/api/templates").then(r => r.json()).then(setTemplates).catch(console.error);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async () => {
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
          variables: form.variables ? form.variables.split(",").map(v => v.trim()) : [],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("common.success"));
      setCreateOpen(false);
      setForm({ name: "", type: "email", category: "general", subject: "", body: "", variables: "" });
      fetchTemplates();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const openEdit = (tmpl: MessageTemplate) => {
    setEditTemplate(tmpl);
    setEditForm({
      name: tmpl.name,
      type: tmpl.type as "email" | "whatsapp",
      category: tmpl.category,
      subject: tmpl.subject || "",
      body: tmpl.body,
      variables: (tmpl.variables || []).join(", "),
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editTemplate || !editForm.name || !editForm.body) return;
    try {
      const res = await fetch(`/api/templates/${editTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          category: editForm.category,
          subject: editForm.subject || null,
          body: editForm.body,
          variables: editForm.variables ? editForm.variables.split(",").map(v => v.trim()) : [],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("common.success"));
      setEditOpen(false);
      fetchTemplates();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/templates/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("common.success"));
      setDeleteId(null);
      fetchTemplates();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    interview_invite: t("templates.category.interview_invite"),
    rejection: t("templates.category.rejection"),
    next_stage: t("templates.category.next_stage"),
    offer: t("templates.category.offer"),
    general: t("templates.category.general"),
  };

  const filtered = templates.filter(t => channelFilter === "all" || t.type === channelFilter);

  const renderTemplateForm = (
    formData: typeof form,
    setFormData: (f: typeof form) => void,
  ) => (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("templates.form.name")} *</Label>
          <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="rounded-lg" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("templates.form.channel")}</Label>
          <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v as "email" | "whatsapp" })}>
            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email">{t("messages.channel.email")}</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("templates.form.category")}</Label>
          <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v as MessageTemplate["category"] })}>
            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="interview_invite">{t("templates.category.interview_invite")}</SelectItem>
              <SelectItem value="rejection">{t("templates.category.rejection")}</SelectItem>
              <SelectItem value="next_stage">{t("templates.category.next_stage")}</SelectItem>
              <SelectItem value="offer">{t("templates.category.offer")}</SelectItem>
              <SelectItem value="general">{t("templates.category.general")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {formData.type === "email" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("templates.form.subject")}</Label>
          <Input value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="rounded-lg" />
        </div>
      )}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("templates.form.body")} *</Label>
        <Textarea value={formData.body} onChange={e => setFormData({ ...formData, body: e.target.value })} rows={6} className="rounded-lg" placeholder={t("templates.placeholder_body")} />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("templates.variables_hint")}</Label>
        <Input value={formData.variables} onChange={e => setFormData({ ...formData, variables: e.target.value })} className="rounded-lg" placeholder={t("templates.placeholder_variables")} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      <div className="border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t("templates.title")}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{templates.length} {t("templates.count_label")}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="rounded-lg text-white" style={{ background: 'var(--brand-gold)' }}>
            <Plus className="ml-2 h-4 w-4" /> {t("templates.new_template")}
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
              style={channelFilter === ch ? { background: 'var(--brand-gold)', color: '#fff' } : { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              {ch === "all" ? t("templates.all_channels") : ch === "email" ? t("messages.channel.email") : "WhatsApp"}
            </button>
          ))}
        </div>

        {/* Templates grid */}
        {filtered.length === 0 ? (
          <div className="rounded-xl p-16 text-center" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
            <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--border-secondary)' }} />
            <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{t("templates.no_templates_title")}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{t("templates.no_templates_hint")}</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(template => (
              <div key={template.id} className="rounded-xl p-5 hover:shadow-md transition-shadow" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{template.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(template)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-secondary)" }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(template.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--red, #EF4444)" }}>
                      <Trash2 size={14} />
                    </button>
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded" style={{ background: template.type === 'email' ? 'var(--bg-tertiary)' : 'var(--green-light)', color: template.type === 'email' ? 'var(--brand-gold)' : 'var(--green)' }}>
                      {template.type === 'email' ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                      {template.type === 'email' ? t("messages.channel.email") : 'WhatsApp'}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                      {categoryLabels[template.category] || template.category}
                    </span>
                  </div>
                </div>
                {template.subject && <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{template.subject}</p>}
                <p className="text-sm line-clamp-3" style={{ color: 'var(--text-tertiary)' }}>{template.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t("templates.new_template")}</DialogTitle>
          </DialogHeader>
          {renderTemplateForm(form, setForm)}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg">{t("common.cancel")}</Button>
            <Button onClick={handleCreate} className="rounded-lg text-white" style={{ background: 'var(--brand-gold)' }}>{t("templates.form.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => !v && setEditOpen(false)}>
        <DialogContent className="max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t("common.edit")}</DialogTitle>
          </DialogHeader>
          {renderTemplateForm(editForm, setEditForm)}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-lg">{t("common.cancel")}</Button>
            <Button onClick={submitEdit} className="rounded-lg text-white" style={{ background: 'var(--brand-gold)' }}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        loading={deleteBusy}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
