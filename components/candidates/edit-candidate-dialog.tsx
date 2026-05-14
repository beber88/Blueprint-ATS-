"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CandidateData {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  experience_years?: number | null;
  education?: string | null;
  skills?: string[] | null;
  notes?: string | null;
}

interface Props {
  open: boolean;
  candidate: CandidateData;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditCandidateDialog({ open, candidate, onClose, onUpdated }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
    experience_years: "",
    education: "",
    skills: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: candidate.full_name || "",
        email: candidate.email || "",
        phone: candidate.phone || "",
        location: candidate.location || "",
        experience_years: candidate.experience_years != null ? String(candidate.experience_years) : "",
        education: candidate.education || "",
        skills: (candidate.skills || []).join(", "),
        notes: candidate.notes || "",
      });
    }
  }, [open, candidate]);

  const handleSubmit = async () => {
    if (!form.full_name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email || null,
          phone: form.phone || null,
          location: form.location || null,
          experience_years: form.experience_years ? parseInt(form.experience_years) : null,
          education: form.education || null,
          skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("common.success"));
      onUpdated();
      onClose();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{t("common.edit")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("candidates.table.candidate")} *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("profile.email")}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg" style={{ direction: "ltr" }} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("profile.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg" style={{ direction: "ltr" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("profile.location")}</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("profile.experience")}</Label>
              <Input type="number" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} className="rounded-lg" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("profile.education")}</Label>
            <Input value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("profile.skills")}</Label>
            <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className="rounded-lg" placeholder="React, Node.js, Python" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("interviews.form.notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="rounded-lg resize-none" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-lg">{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-lg text-white" style={{ background: "var(--brand-gold)" }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
