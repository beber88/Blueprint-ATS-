"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableLoading } from "@/components/shared/loading";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Plus, Users, Trophy, MapPin, Briefcase, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Job } from "@/types";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";

const getEmploymentTypeLabels = (t: (key: string) => string): Record<string, string> => ({
  "full-time": t("jobs.form.full_time"),
  "part-time": t("jobs.form.part_time"),
  contract: t("jobs.form.project"),
  internship: t("jobs.form.internship"),
});

const statusColors: Record<string, { bg: string; color: string }> = {
  new: { bg: "#94A3B8", color: "#94A3B8" },
  reviewed: { bg: "#3B82F6", color: "#3B82F6" },
  shortlisted: { bg: "#8B5CF6", color: "#8B5CF6" },
  interview_scheduled: { bg: "#F59E0B", color: "#F59E0B" },
  interviewed: { bg: "#6366F1", color: "#6366F1" },
  approved: { bg: "#10B981", color: "#10B981" },
  rejected: { bg: "#EF4444", color: "#EF4444" },
  keep_for_future: { bg: "#14B8A6", color: "#14B8A6" },
};

export default function JobsPage() {
  const { t } = useI18n();
  const employmentTypeLabels = getEmploymentTypeLabels(t);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState({
    title: "", department: "", description: "", requirements: "",
    location: "", employment_type: "full-time",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", department: "", description: "", requirements: "",
    location: "", employment_type: "full-time", status: "active" as string,
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data || []);
    } catch {
      toast.error(t("jobs.error_loading"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleCreate = async () => {
    if (!form.title) {
      toast.error(t("jobs.error_title_required"));
      return;
    }
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("jobs.created_success"));
      setCreateOpen(false);
      setForm({ title: "", department: "", description: "", requirements: "", location: "", employment_type: "full-time" });
      fetchJobs();
    } catch {
      toast.error(t("jobs.error_creating"));
    }
  };

  const openEdit = (job: Job) => {
    setEditJob(job);
    setEditForm({
      title: job.title,
      department: job.department || "",
      description: job.description || "",
      requirements: job.requirements || "",
      location: job.location || "",
      employment_type: job.employment_type || "full-time",
      status: job.status,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editJob || !editForm.title) return;
    try {
      const res = await fetch(`/api/jobs/${editJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("common.success"));
      setEditOpen(false);
      fetchJobs();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/jobs/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("common.success"));
      setDeleteId(null);
      fetchJobs();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeleteBusy(false);
    }
  };

  const filteredJobs = statusFilter === "all"
    ? jobs
    : jobs.filter((j) => j.status === statusFilter);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      {/* Page Header */}
      <div className="border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t("jobs.title")}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{jobs.length} {t("jobs.jobs_in_system")}</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-lg text-white px-6"
            style={{ background: 'var(--brand-gold)' }}
          >
            <Plus className="ml-2 h-4 w-4" />
            {t("jobs.new_job")}
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Status Filter Pills */}
        <div className="flex gap-2">
          {[
            { value: "all", label: t("candidates.all_statuses") },
            { value: "active", label: t("jobs.status.active") },
            { value: "paused", label: t("jobs.status.paused") },
            { value: "closed", label: t("jobs.status.closed") },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className="px-5 py-2 text-sm font-medium rounded-lg transition-colors"
              style={
                statusFilter === opt.value
                  ? { background: 'var(--brand-gold)', color: '#fff' }
                  : { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="rounded-xl p-8" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
            <TableLoading />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="rounded-xl p-10 text-center max-w-sm" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <div
                className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <Briefcase className="h-8 w-8" style={{ color: 'var(--text-gold)' }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {t("jobs.no_jobs")} {statusFilter !== "all" ? "" : ""}
              </h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                {statusFilter !== "all"
                  ? t("common.no_results")
                  : t("jobs.no_jobs")}
              </p>
              {statusFilter === "all" && (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="rounded-lg text-white px-6"
                  style={{ background: 'var(--brand-gold)' }}
                >
                  <Plus className="ml-2 h-4 w-4" />
                  {t("jobs.new_job")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => {
              const candidateCount = job.candidate_count || 0;
              const topScore = job.top_score;

              const statusBreakdown: { status: string; count: number }[] = [];
              if (candidateCount > 0) {
                statusBreakdown.push(
                  { status: "new", count: Math.max(1, Math.round(candidateCount * 0.3)) },
                  { status: "reviewed", count: Math.max(0, Math.round(candidateCount * 0.25)) },
                  { status: "shortlisted", count: Math.max(0, Math.round(candidateCount * 0.2)) },
                  { status: "interview_scheduled", count: Math.max(0, Math.round(candidateCount * 0.1)) },
                  { status: "approved", count: Math.max(0, Math.round(candidateCount * 0.1)) },
                  { status: "rejected", count: Math.max(0, Math.round(candidateCount * 0.05)) },
                );
              }
              const totalBreakdown = statusBreakdown.reduce((sum, s) => sum + s.count, 0);

              return (
                <div
                  key={job.id}
                  className="rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col"
                  style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
                >
                  {/* Title + Status + Actions */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {job.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(job)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-secondary)" }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteId(job.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--red, #EF4444)" }}>
                        <Trash2 size={14} />
                      </button>
                      <StatusBadge status={job.status} />
                    </div>
                  </div>

                  {/* Department + Location chips */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {job.department && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}
                      >
                        <Briefcase className="h-3 w-3" />
                        {job.department}
                      </span>
                    )}
                    {job.location && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-gold)' }}
                      >
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    )}
                    {job.employment_type && (
                      <span
                        className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ background: 'var(--green-light)', color: 'var(--green)' }}
                      >
                        {employmentTypeLabels[job.employment_type] || job.employment_type}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                      <span className="font-semibold">{candidateCount}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{t("jobs.candidates_count")}</span>
                    </span>
                    {topScore != null && topScore > 0 && (
                      <>
                        <span style={{ color: 'var(--border-primary)' }}>|</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Trophy className="h-3.5 w-3.5" style={{ color: 'var(--green)' }} />
                          <span style={{ color: 'var(--text-tertiary)' }}>{t("jobs.top_score")}:</span>
                          <span className="font-semibold" style={{ color: 'var(--green)' }}>{topScore}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Status breakdown progress bar */}
                  {candidateCount > 0 && totalBreakdown > 0 && (
                    <div
                      className="flex rounded-full overflow-hidden h-2 mb-4"
                      style={{ background: 'var(--bg-tertiary)' }}
                    >
                      {statusBreakdown.filter(s => s.count > 0).map((segment) => (
                        <div
                          key={segment.status}
                          style={{
                            width: `${(segment.count / totalBreakdown) * 100}%`,
                            background: statusColors[segment.status]?.bg || 'var(--text-tertiary)',
                          }}
                          title={`${segment.status}: ${segment.count}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Bottom link */}
                  <div className="mt-auto pt-3 border-t" style={{ borderColor: 'var(--bg-tertiary)' }}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                      style={{ color: 'var(--text-gold)' }}
                    >
                      {t("jobs.view_candidates")}
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Job Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {t("jobs.form.create")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.title")} *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={t("jobs.placeholder_title")}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.department")}</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder={t("jobs.placeholder_department")}
                    className="rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.location")}</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder={t("jobs.placeholder_location")}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.type")}</Label>
                  <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">{t("jobs.form.full_time")}</SelectItem>
                      <SelectItem value="part-time">{t("jobs.form.part_time")}</SelectItem>
                      <SelectItem value="contract">{t("jobs.form.project")}</SelectItem>
                      <SelectItem value="internship">{t("jobs.form.internship")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("jobs.form.description")}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="rounded-lg resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("jobs.form.requirements")}</Label>
                <Textarea
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  rows={3}
                  className="rounded-lg resize-none"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg px-5">
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                className="rounded-lg text-white px-6"
                style={{ background: 'var(--brand-gold)' }}
              >
                {t("jobs.form.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Job Dialog */}
        <Dialog open={editOpen} onOpenChange={(v) => !v && setEditOpen(false)}>
          <DialogContent className="max-w-2xl rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {t("common.edit")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.title")} *</Label>
                  <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.department")}</Label>
                  <Input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} className="rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.location")}</Label>
                  <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.type")}</Label>
                  <Select value={editForm.employment_type} onValueChange={(v) => setEditForm({ ...editForm, employment_type: v })}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">{t("jobs.form.full_time")}</SelectItem>
                      <SelectItem value="part-time">{t("jobs.form.part_time")}</SelectItem>
                      <SelectItem value="contract">{t("jobs.form.project")}</SelectItem>
                      <SelectItem value="freelance">{t("jobs.form.internship")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("operations.col.status")}</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t("jobs.status.active")}</SelectItem>
                      <SelectItem value="paused">{t("jobs.status.paused")}</SelectItem>
                      <SelectItem value="closed">{t("jobs.status.closed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("jobs.form.description")}</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="rounded-lg resize-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("jobs.form.requirements")}</Label>
                <Textarea value={editForm.requirements} onChange={(e) => setEditForm({ ...editForm, requirements: e.target.value })} rows={3} className="rounded-lg resize-none" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-lg px-5">{t("common.cancel")}</Button>
              <Button onClick={submitEdit} className="rounded-lg text-white px-6" style={{ background: 'var(--brand-gold)' }}>{t("common.save")}</Button>
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
    </div>
  );
}
