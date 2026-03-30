"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageLoading } from "@/components/shared/loading";
import { Plus, Calendar, Clock, User, Video, Phone, MapPin } from "lucide-react";
import { Interview, Candidate, Job } from "@/types";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";

export default function InterviewsPage() {
  const { t } = useI18n();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState({
    candidate_id: "", job_id: "", scheduled_at: "", duration_minutes: "60",
    interviewer: "", type: "in-person", notes: "",
  });

  const fetchInterviews = async () => {
    try {
      const res = await fetch("/api/interviews");
      setInterviews(await res.json());
    } catch {
      toast.error(t("interviews.error_loading"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInterviews(); }, []);

  useEffect(() => {
    fetch("/api/candidates").then((res) => res.json()).then((data) => setCandidates(data.candidates || [])).catch(() => {});
    fetch("/api/jobs").then((res) => res.json()).then(setJobs).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duration_minutes: parseInt(form.duration_minutes),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("interviews.created_success"));
      setCreateOpen(false);
      fetchInterviews();
    } catch {
      toast.error(t("interviews.error_creating"));
    }
  };

  const updateOutcome = async (id: string, outcome: string, notes: string) => {
    try {
      await fetch(`/api/interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, notes }),
      });
      toast.success(t("interviews.updated_success"));
      fetchInterviews();
    } catch {
      toast.error(t("interviews.error_updating"));
    }
  };

  const typeIcons = {
    "in-person": MapPin,
    video: Video,
    phone: Phone,
  };

  const typeLabels: Record<string, string> = {
    "in-person": t("interviews.type.in_person"),
    video: t("interviews.type.video"),
    phone: t("interviews.type.phone"),
  };

  const now = new Date();
  const upcoming = interviews.filter((i) => i.scheduled_at && new Date(i.scheduled_at) >= now);
  const past = interviews.filter((i) => i.scheduled_at && new Date(i.scheduled_at) < now);

  if (loading) return <PageLoading />;

  return (
    <div className="min-h-screen bg-[color:var(--bg-secondary)]" dir="rtl">
      <Header title={t("interviews.title")} subtitle={`${upcoming.length} ${t("interviews.upcoming")}`} />

      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">{t("interviews.title")}</h1>
            <p className="text-sm text-[color:var(--text-tertiary)] mt-1">{upcoming.length} {t("interviews.upcoming")}</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[color:var(--bg-tertiary)]0 hover:bg-[color:var(--brand-gold)] text-white rounded-xl px-6 py-2.5 shadow-sm transition-colors"
          >
            <Plus className="ml-2 h-4 w-4" />
            {t("interviews.schedule")}
          </Button>
        </div>

        {/* Upcoming Interviews */}
        <div className="rounded-xl shadow-sm border border-[color:var(--bg-tertiary)] overflow-hidden">
          <div className="p-5 border-b border-[color:var(--bg-tertiary)] flex items-center gap-3">
            <div className="w-10 h-10 bg-[color:var(--bg-tertiary)] rounded-xl flex items-center justify-center">
              <Calendar className="h-5 w-5 text-[color:var(--text-gold)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[color:var(--text-primary)]">{t("interviews.upcoming")}</h2>
              <p className="text-sm text-[color:var(--text-tertiary)]">{upcoming.length} {t("interviews.upcoming")}</p>
            </div>
          </div>
          <div className="p-5">
            {upcoming.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 bg-[color:var(--bg-secondary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-7 w-7 text-[color:var(--border-secondary)]" />
                </div>
                <p className="text-[color:var(--text-tertiary)] font-medium">{t("common.no_results")}</p>
                <p className="text-sm text-[color:var(--text-tertiary)] mt-1">{t("interviews.schedule_first_hint")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((interview) => {
                  const TypeIcon = typeIcons[interview.type as keyof typeof typeIcons] || MapPin;
                  const app = interview.application as Interview["application"];
                  const scheduledDate = interview.scheduled_at ? new Date(interview.scheduled_at) : null;
                  return (
                    <div
                      key={interview.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-[color:var(--bg-tertiary)] hover:shadow-sm transition-shadow"
                    >
                      {/* Date Badge */}
                      <div className="flex flex-col items-center justify-center bg-[color:var(--bg-tertiary)] rounded-xl p-3 min-w-[64px]">
                        <span className="text-xl font-bold text-[color:var(--text-gold)]">
                          {scheduledDate ? scheduledDate.getDate() : "?"}
                        </span>
                        <span className="text-xs font-medium text-[color:var(--text-gold)]">
                          {scheduledDate ? scheduledDate.toLocaleString("he-IL", { month: "short" }) : ""}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/candidates/${app?.candidate?.id}`}
                            className="font-semibold text-[color:var(--text-primary)] hover:text-[color:var(--text-gold)] transition-colors truncate"
                          >
                            {app?.candidate?.full_name || t("common.unknown")}
                          </Link>
                          <span className="inline-flex items-center gap-1 text-xs bg-[color:var(--bg-tertiary)] text-[color:var(--text-secondary)] px-2.5 py-0.5 rounded-lg font-medium">
                            <TypeIcon className="h-3 w-3" />
                            {typeLabels[interview.type] || interview.type}
                          </span>
                        </div>
                        <p className="text-sm text-[color:var(--text-tertiary)] truncate">{app?.job?.title || t("common.unknown")}</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-[color:var(--text-tertiary)]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {scheduledDate ? formatDateTime(interview.scheduled_at!) : "TBD"}
                          </span>
                          <span>{interview.duration_minutes} {t("common.minutes")}</span>
                          {interview.interviewer && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {interview.interviewer}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Past Interviews */}
        {past.length > 0 && (
          <div className="rounded-xl shadow-sm border border-[color:var(--bg-tertiary)] overflow-hidden">
            <div className="p-5 border-b border-[color:var(--bg-tertiary)]">
              <h2 className="text-lg font-bold text-[color:var(--text-primary)]">{t("interviews.past")}</h2>
              <p className="text-sm text-[color:var(--text-tertiary)]">{past.length} {t("interviews.past_count")}</p>
            </div>
            <div className="divide-y divide-[color:var(--bg-secondary)]">
              {past.map((interview) => {
                const app = interview.application as Interview["application"];
                return (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 px-5 hover:bg-[color:var(--bg-secondary)]/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/candidates/${app?.candidate?.id}`}
                        className="font-medium text-[color:var(--text-primary)] hover:text-[color:var(--text-gold)] transition-colors"
                      >
                        {app?.candidate?.full_name || t("common.unknown")}
                      </Link>
                      <p className="text-sm text-[color:var(--text-tertiary)] mt-0.5">
                        {app?.job?.title} &middot; {interview.scheduled_at ? formatDateTime(interview.scheduled_at) : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mr-4">
                      {interview.outcome ? (
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                            interview.outcome === "passed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-red-50 text-red-700 border border-red-100"
                          }`}
                        >
                          {interview.outcome === "passed" ? t("interviews.outcome.passed") : t("interviews.outcome.failed")}
                        </span>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateOutcome(interview.id, "passed", "")}
                            className="rounded-lg text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            {t("interviews.outcome.passed")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateOutcome(interview.id, "failed", "")}
                            className="rounded-lg text-xs border-red-200 text-red-700 hover:bg-red-50"
                          >
                            {t("interviews.outcome.failed")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Schedule Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b border-[color:var(--bg-tertiary)]">
              <DialogTitle className="text-xl font-bold text-[color:var(--text-primary)]">{t("interviews.schedule")}</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[color:var(--text-secondary)]">{t("interviews.form.candidate")}</Label>
                <Select value={form.candidate_id} onValueChange={(v) => setForm({ ...form, candidate_id: v })}>
                  <SelectTrigger className="rounded-xl border-[color:var(--border-primary)]">
                    <SelectValue placeholder={t("messages.select_candidate")} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[color:var(--text-secondary)]">{t("nav.jobs")}</Label>
                <Select value={form.job_id} onValueChange={(v) => setForm({ ...form, job_id: v })}>
                  <SelectTrigger className="rounded-xl border-[color:var(--border-primary)]">
                    <SelectValue placeholder={t("messages.select_template")} />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[color:var(--text-secondary)]">{t("interviews.form.date")}</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                    className="rounded-xl border-[color:var(--border-primary)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[color:var(--text-secondary)]">{t("interviews.form.duration")}</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    className="rounded-xl border-[color:var(--border-primary)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[color:var(--text-secondary)]">{t("interviews.form.type")}</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="rounded-xl border-[color:var(--border-primary)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in-person">{t("interviews.type.in_person")}</SelectItem>
                      <SelectItem value="video">{t("interviews.type.video")}</SelectItem>
                      <SelectItem value="phone">{t("interviews.type.phone")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[color:var(--text-secondary)]">{t("interviews.form.interviewer")}</Label>
                  <Input
                    value={form.interviewer}
                    onChange={(e) => setForm({ ...form, interviewer: e.target.value })}
                    className="rounded-xl border-[color:var(--border-primary)]"
                    placeholder={t("interviews.placeholder_interviewer")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[color:var(--text-secondary)]">{t("interviews.form.notes")}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="rounded-xl border-[color:var(--border-primary)] resize-none"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t border-[color:var(--bg-tertiary)] gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl px-5">
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreate} className="bg-[color:var(--bg-tertiary)]0 hover:bg-[color:var(--brand-gold)] text-white rounded-xl px-6">
                {t("interviews.schedule")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
