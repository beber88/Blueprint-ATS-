/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageLoading } from "@/components/shared/loading";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Zap, MapPin, Clock, Building, GitCompare, Users, FileText, BarChart3, Trophy, Table, Loader2, ClipboardList, Pencil } from "lucide-react";
import { Job, Application, Candidate } from "@/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from "recharts";

interface JobDetail extends Job {
  applications: (Application & { candidate: Candidate })[];
}

type TabKey = "table" | "charts" | "top" | "requirements";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabKey>("table");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [requirements, setRequirements] = useState<Record<string, unknown> | null>(null);
  const [matches, setMatches] = useState<Record<string, unknown>[]>([]);
  const [matching, setMatching] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", department: "", description: "", requirements: "",
    location: "", employment_type: "full-time", status: "active",
  });

  const toggleCandidate = (appId: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  useEffect(() => {
    fetch(`/api/jobs/${params.id}`)
      .then((res) => res.json())
      .then(setJob)
      .catch(() => toast.error(t("common.error")))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    // Fetch requirements
    fetch(`/api/jobs/${params.id}/questionnaire`).catch(() => {});
    // Fetch existing matches
    fetch(`/api/jobs/${params.id}/match-candidates`).then(r => r.json()).then(d => setMatches(d.matches || [])).catch(() => {});
  }, [params.id]);

  const startQuestionnaire = () => {
    router.push(`/jobs/${params.id}/questionnaire`);
  };

  const runMatching = async () => {
    setMatching(true);
    toast.info(t("requirements.matching"));
    try {
      const res = await fetch(`/api/jobs/${params.id}/match-candidates`, { method: "POST" });
      const data = await res.json();
      toast.success(`${t("candidates.toast.matched")} ${data.matched}/${data.total}`);
      // Refresh matches
      const refreshed = await fetch(`/api/jobs/${params.id}/match-candidates`).then(r => r.json());
      setMatches(refreshed.matches || []);
    } catch { toast.error(t("common.error")); }
    finally { setMatching(false); }
  };

  const openEditDialog = () => {
    if (!job) return;
    setEditForm({
      title: job.title, department: job.department || "", description: job.description || "",
      requirements: job.requirements || "", location: job.location || "",
      employment_type: job.employment_type || "full-time", status: job.status,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!job) return;
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      toast.success(t("common.success"));
      setEditOpen(false);
      const refreshed = await fetch(`/api/jobs/${params.id}`);
      if (refreshed.ok) setJob(await refreshed.json());
    } catch { toast.error(t("common.error")); }
  };

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/jobs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setJob((prev) => prev ? { ...prev, status: status as Job["status"] } : null);
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const runBatchScoring = async () => {
    if (!job) return;
    setScoring(true);
    const unscored = job.applications.filter((a) => a.ai_score === null);

    if (unscored.length === 0) {
      toast.info(t("common.no_results"));
      setScoring(false);
      return;
    }

    let scored = 0;
    let failed = 0;
    for (const app of unscored) {
      try {
        const res = await fetch("/api/cv/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: app.candidate_id, jobId: job.id }),
        });
        if (res.ok) {
          scored++;
        } else {
          const data = await res.json();
          console.error("Score failed:", data.error);
          failed++;
        }
      } catch {
        failed++;
      }
      toast.info(`${t("common.scoring_progress")}: ${scored + failed}/${unscored.length}`, { id: "scoring-progress" });
    }

    if (failed > 0) {
      toast.warning(`${t("common.scored_candidates")}: ${scored}, ${t("common.scoring_failed")}: ${failed}`);
    } else {
      toast.success(`${scored} ${t("common.scored_candidates")} ${t("common.scored_success")}`);
    }
    setScoring(false);
    const res = await fetch(`/api/jobs/${params.id}`);
    if (res.ok) {
      setJob(await res.json());
    }
  };

  const candidates = useMemo(() => job?.applications || [], [job]);

  const topCandidates = useMemo(
    () =>
      [...candidates]
        .filter((a) => a.ai_score !== null)
        .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
        .slice(0, 5),
    [candidates]
  );

  const statusData = useMemo(
    () =>
      Object.entries(
        candidates.reduce((acc, app) => {
          acc[app.status] = (acc[app.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([status, count]) => ({ status, count })),
    [candidates]
  );

  const radarData = useMemo(() => {
    const top = topCandidates.slice(0, 3);
    if (top.length === 0) return [];

    const dimensions = [
      { key: "ai_score", label: t("candidates.table.ai_score") },
      { key: "experience", label: t("candidates.table.experience") },
      { key: "skills", label: t("profile.skills") },
    ];

    return dimensions.map((dim) => {
      const row: Record<string, string | number> = { dimension: dim.label };
      top.forEach((app) => {
        const name = app.candidate?.full_name?.split(" ")[0] || "?";
        if (dim.key === "ai_score") {
          row[name] = app.ai_score || 0;
        } else if (dim.key === "experience") {
          row[name] = Math.min((app.candidate?.experience_years || 0) * 10, 100);
        } else if (dim.key === "skills") {
          row[name] = Math.min((app.candidate?.skills?.length || 0) * 15, 100);
        }
      });
      return row;
    });
  }, [topCandidates, t]);

  const radarCandidateNames = useMemo(
    () => topCandidates.slice(0, 3).map((app) => app.candidate?.full_name?.split(" ")[0] || "?"),
    [topCandidates]
  );

  if (loading) return <PageLoading />;
  if (!job) return <div className="p-6 text-center text-[color:var(--text-tertiary)]">{t("common.job_not_found")}</div>;

  const employmentTypeLabels: Record<string, string> = {
    "full-time": t("jobs.form.full_time"),
    "part-time": t("jobs.form.part_time"),
    contract: t("jobs.form.contract"),
    internship: t("jobs.form.internship"),
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "table", label: t("common.table"), icon: <Table className="h-4 w-4" /> },
    { key: "charts", label: t("common.charts"), icon: <BarChart3 className="h-4 w-4" /> },
    { key: "top", label: "TOP " + t("nav.candidates"), icon: <Trophy className="h-4 w-4" /> },
    { key: "requirements", label: t("requirements.title"), icon: <ClipboardList className="h-4 w-4" /> },
  ];

  const statusColors: Record<string, string> = {
    new: "#94A3B8",
    scored: "#06B6D4",
    shortlisted: "#8B5CF6",
    interview_scheduled: "#F59E0B",
    interviewed: "#6366F1",
    approved: "#10B981",
    rejected: "#EF4444",
    reviewed: "#38BDF8",
    keep_for_future: "#A78BFA",
  };

  const radarColors = ["var(--brand-gold)", "var(--green)", "var(--amber)"];

  return (
    <div className="min-h-screen bg-[color:var(--bg-secondary)]" dir="rtl">
      <Header title={job.title} subtitle={job.department || t("common.job_details")} />

      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] gap-2 rounded-xl px-3"
          >
            <ArrowRight className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <div className="flex items-center gap-3">
            <Select value={job.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-36 rounded-xl shadow-sm border-[color:var(--border-primary)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("jobs.status.active")}</SelectItem>
                <SelectItem value="paused">{t("jobs.status.paused")}</SelectItem>
                <SelectItem value="closed">{t("jobs.status.closed")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={openEditDialog}
              className="rounded-xl shadow-sm gap-2 px-4"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </Button>
            <Button
              onClick={runBatchScoring}
              disabled={scoring}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm gap-2 px-5"
            >
              <Zap className="h-4 w-4" />
              {scoring ? t("common.loading") : t("profile.run_ai_analysis")}
            </Button>
          </div>
        </div>

        {/* Job Info Card */}
        <div className="rounded-xl shadow-sm border border-[color:var(--bg-tertiary)] overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-2xl font-bold text-[color:var(--text-primary)]">{job.title}</h1>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[color:var(--text-tertiary)]">
                  {job.department && (
                    <span className="flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                      {job.department}
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                      {job.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                    {employmentTypeLabels[job.employment_type] || job.employment_type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {(job.description || job.requirements) && (
            <div className="border-t border-[color:var(--bg-tertiary)] p-6 space-y-5">
              {job.description && (
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[color:var(--text-tertiary)]" />
                    {t("jobs.form.description")}
                  </h3>
                  <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
              {job.requirements && (
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-2">{t("jobs.form.requirements")}</h3>
                  <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{job.requirements}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Candidates Section */}
        <div className="rounded-xl shadow-sm border border-[color:var(--bg-tertiary)] overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between p-5 border-b border-[color:var(--bg-tertiary)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[color:var(--bg-tertiary)] rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-[color:var(--text-gold)]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[color:var(--text-primary)]">{t("candidates.title")}</h2>
                <p className="text-sm text-[color:var(--text-tertiary)]">{candidates.length} {t("common.applications")}</p>
              </div>
            </div>
            {activeTab === "table" && (
              <Button
                variant={compareMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCompareMode(!compareMode);
                  if (compareMode) setSelectedCandidates(new Set());
                }}
                className={`rounded-xl gap-2 transition-colors ${compareMode ? "bg-[color:var(--bg-tertiary)]0 hover:bg-[color:var(--brand-gold)] text-white" : "border-[color:var(--border-primary)]"}`}
              >
                <GitCompare className="h-4 w-4" />
                {compareMode ? t("common.cancel_compare") : t("common.compare")}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[color:var(--bg-tertiary)] px-5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[color:var(--brand-gold)] text-[color:var(--text-gold)]"
                    : "border-transparent text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)] hover:border-[color:var(--border-secondary)]"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "requirements" ? (
              /* REQUIREMENTS TAB - renders regardless of candidates */
              <div className="p-6 space-y-6">
                {/* Requirements content */}
                <div className="rounded-xl p-6" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}>
                  <h3 className="font-bold text-lg mb-4" style={{ color: "var(--text-primary)" }}>{t("requirements.title")}</h3>

                  {/* Show questionnaire button or requirements summary */}
                  <div className="space-y-4">
                    <Button onClick={startQuestionnaire} className="rounded-lg" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}>
                      {t("requirements.questionnaire")}
                    </Button>
                    <Button onClick={runMatching} disabled={matching} variant="outline" className="rounded-lg mr-2">
                      {matching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {t("requirements.find_candidates")}
                    </Button>
                  </div>
                </div>

                {/* Match results */}
                {matches.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: "var(--bg-tertiary)" }}>
                          <th className="text-right px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>#</th>
                          <th className="text-right px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>Name</th>
                          <th className="text-right px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>Score</th>
                          <th className="text-right px-4 py-3 text-xs" style={{ color: "var(--text-tertiary)" }}>Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((m: any, i: number) => (
                          <tr key={m.id} style={{ borderBottom: "0.5px solid var(--border-light)" }}>
                            <td className="px-4 py-3 font-bold" style={{ color: "var(--text-gold)" }}>#{i+1}</td>
                            <td className="px-4 py-3">
                              <Link href={`/candidates/${m.candidate?.id}`} className="font-medium" style={{ color: "var(--text-primary)" }}>
                                {m.candidate?.full_name}
                              </Link>
                            </td>
                            <td className="px-4 py-3"><ScoreBadge score={m.total_score || 0} size="sm" /></td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                background: m.recommendation === "strong_match" ? "var(--status-approved-bg)" : m.recommendation === "good_match" ? "var(--status-shortlisted-bg)" : "var(--status-new-bg)",
                                color: m.recommendation === "strong_match" ? "var(--status-approved-text)" : m.recommendation === "good_match" ? "var(--status-shortlisted-text)" : "var(--status-new-text)",
                              }}>{t(`requirements.${m.recommendation}`)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-[color:var(--bg-secondary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-[color:var(--border-secondary)]" />
              </div>
              <p className="text-[color:var(--text-tertiary)] font-medium">{t("common.no_applications_yet")}</p>
              <p className="text-sm text-[color:var(--text-tertiary)] mt-1">{t("common.applications_will_appear")}</p>
            </div>
          ) : (
            <>
              {/* TABLE TAB */}
              {activeTab === "table" && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[color:var(--bg-tertiary)] bg-[color:var(--bg-secondary)]/50 text-right">
                        {compareMode && <th className="py-3 px-4 w-12"></th>}
                        <th className="py-3 px-5 text-xs font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wider">{t("candidates.table.candidate")}</th>
                        <th className="py-3 px-5 text-xs font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wider">{t("candidates.table.ai_score")}</th>
                        <th className="py-3 px-5 text-xs font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wider">{t("candidates.table.status")}</th>
                        <th className="py-3 px-5 text-xs font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wider">{t("candidates.table.experience")}</th>
                        <th className="py-3 px-5 text-xs font-semibold text-[color:var(--text-tertiary)] uppercase tracking-wider">{t("common.application_date")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--bg-secondary)]">
                      {candidates.map((app) => (
                        <tr
                          key={app.id}
                          className={`hover:bg-[color:var(--bg-secondary)]/80 transition-colors ${
                            compareMode && selectedCandidates.has(app.id) ? "bg-[color:var(--bg-tertiary)]/60" : ""
                          }`}
                        >
                          {compareMode && (
                            <td className="py-3.5 px-4">
                              <Checkbox
                                checked={selectedCandidates.has(app.id)}
                                onCheckedChange={() => toggleCandidate(app.id)}
                              />
                            </td>
                          )}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-[color:var(--bg-tertiary)] text-[color:var(--text-gold)] text-xs font-semibold">
                                  {app.candidate?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <Link
                                href={`/candidates/${app.candidate_id}`}
                                className="font-medium text-[color:var(--text-primary)] hover:text-[color:var(--text-gold)] transition-colors"
                              >
                                {app.candidate?.full_name}
                              </Link>
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            {app.ai_score !== null ? (
                              <ScoreBadge score={app.ai_score} size="sm" />
                            ) : (
                              <span className="text-xs text-[color:var(--text-tertiary)] bg-[color:var(--bg-tertiary)] px-2.5 py-1 rounded-lg">{t("common.not_scored")}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5">
                            <StatusBadge status={app.status} />
                          </td>
                          <td className="py-3.5 px-5 text-sm text-[color:var(--text-secondary)]">
                            {app.candidate?.experience_years != null
                              ? `${app.candidate.experience_years} ${t("candidates.years")}`
                              : "-"}
                          </td>
                          <td className="py-3.5 px-5 text-sm text-[color:var(--text-tertiary)]">
                            {formatDate(app.applied_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CHARTS TAB */}
              {activeTab === "charts" && (
                <div className="p-6 space-y-8">
                  {/* Chart 1: Score Distribution */}
                  <div className="bg-[color:var(--bg-secondary)] rounded-xl p-5 border border-[color:var(--bg-tertiary)]">
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-4">{t("common.score_distribution")}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={candidates.map((app) => ({
                          name: app.candidate?.full_name?.split(" ")[0] || "?",
                          score: app.ai_score || 0,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-tertiary)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                          {candidates.map((app, i) => (
                            <Cell
                              key={i}
                              fill={
                                (app.ai_score || 0) >= 71
                                  ? "var(--green)"
                                  : (app.ai_score || 0) >= 41
                                  ? "var(--amber)"
                                  : "var(--red)"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart 2: Experience vs Score Scatter */}
                  <div className="bg-[color:var(--bg-secondary)] rounded-xl p-5 border border-[color:var(--bg-tertiary)]">
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-4">
                      {t("candidates.table.experience")} {t("common.vs_ai_score")}
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-tertiary)" />
                        <XAxis dataKey="experience" name="Experience" unit="y" />
                        <YAxis dataKey="score" name="Score" domain={[0, 100]} />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                        <Scatter
                          data={candidates.map((app) => ({
                            experience: app.candidate?.experience_years || 0,
                            score: app.ai_score || 0,
                            name: app.candidate?.full_name,
                          }))}
                          fill="var(--brand-gold)"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart 3: Pipeline Status */}
                  <div className="bg-[color:var(--bg-secondary)] rounded-xl p-5 border border-[color:var(--bg-tertiary)]">
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-4">{t("common.status_breakdown")}</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={statusData} layout="vertical">
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="status" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                          {statusData.map((entry, i) => (
                            <Cell key={i} fill={statusColors[entry.status] || "#94A3B8"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart 4: Radar Comparison of Top Candidates */}
                  <div className="bg-[color:var(--bg-secondary)] rounded-xl p-5 border border-[color:var(--bg-tertiary)]">
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)] mb-4">{t("common.top_comparison_radar")}</h3>
                    {radarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="var(--bg-tertiary)" />
                          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          {radarCandidateNames.map((name, i) => (
                            <Radar
                              key={name}
                              name={name}
                              dataKey={name}
                              stroke={radarColors[i]}
                              fill={radarColors[i]}
                              fillOpacity={0.15}
                            />
                          ))}
                          <Legend />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-10 text-sm text-[color:var(--text-tertiary)]">
                        {t("common.no_scored_for_compare")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TOP CANDIDATES TAB */}
              {activeTab === "top" && (
                <div className="p-6">
                  {topCandidates.length === 0 ? (
                    <div className="text-center py-12">
                      <Trophy className="h-10 w-10 text-[color:var(--border-secondary)] mx-auto mb-3" />
                      <p className="text-[color:var(--text-tertiary)] font-medium">{t("common.no_scored_yet")}</p>
                      <p className="text-sm text-[color:var(--text-tertiary)] mt-1">{t("common.run_ai_to_see_top")}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {topCandidates.map((app, index) => (
                        <div
                          key={app.id}
                          className="flex items-center gap-5 bg-[color:var(--bg-secondary)] rounded-xl p-5 border border-[color:var(--bg-tertiary)] hover:border-[color:var(--brand-gold)] transition-colors"
                        >
                          {/* Rank */}
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                              index === 0
                                ? "bg-amber-100 text-amber-700"
                                : index === 1
                                ? "bg-[color:var(--border-primary)] text-[color:var(--text-secondary)]"
                                : index === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-[color:var(--bg-tertiary)] text-[color:var(--text-tertiary)]"
                            }`}
                          >
                            {index + 1}
                          </div>

                          {/* Score Circle */}
                          <div className="flex-shrink-0">
                            <div
                              className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                                (app.ai_score || 0) >= 71
                                  ? "bg-emerald-500"
                                  : (app.ai_score || 0) >= 41
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                            >
                              {app.ai_score}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/candidates/${app.candidate_id}`}
                              className="font-bold text-[color:var(--text-primary)] hover:text-[color:var(--text-gold)] transition-colors text-lg"
                            >
                              {app.candidate?.full_name}
                            </Link>
                            <div className="flex items-center gap-3 mt-1 text-sm text-[color:var(--text-tertiary)]">
                              {app.candidate?.experience_years != null && (
                                <span>{app.candidate.experience_years} {t("candidates.years")} {t("candidates.table.experience")}</span>
                              )}
                              <StatusBadge status={app.status} />
                            </div>
                            {app.ai_reasoning && (
                              <p className="text-sm text-[color:var(--text-secondary)] mt-2 line-clamp-2">{app.ai_reasoning}</p>
                            )}
                            {app.candidate?.skills && app.candidate.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {app.candidate.skills.slice(0, 6).map((skill) => (
                                  <Badge key={skill} variant="secondary" className="text-xs shadow-sm border border-[color:var(--bg-tertiary)]">
                                    {skill}
                                  </Badge>
                                ))}
                                {app.candidate.skills.length > 6 && (
                                  <span className="text-xs text-[color:var(--text-tertiary)] self-center">+{app.candidate.skills.length - 6}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Comparison Panel */}
        {compareMode && selectedCandidates.size >= 2 && (
          <div className="rounded-xl shadow-sm border border-[color:var(--bg-tertiary)] overflow-hidden">
            <div className="p-5 border-b border-[color:var(--bg-tertiary)] bg-[color:var(--bg-secondary)]/50">
              <h2 className="text-lg font-bold text-[color:var(--text-primary)] flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-[color:var(--text-gold)]" />
                {t("common.candidate_comparison")}
                <span className="text-sm font-normal text-[color:var(--text-tertiary)]">({selectedCandidates.size} {t("common.selected")})</span>
              </h2>
            </div>
            <div className="p-5">
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${selectedCandidates.size}, minmax(0, 1fr))` }}
              >
                {candidates
                  .filter((app) => selectedCandidates.has(app.id))
                  .map((app) => (
                    <div key={app.id} className="bg-[color:var(--bg-secondary)] rounded-xl p-5 space-y-4 border border-[color:var(--bg-tertiary)]">
                      <div className="text-center pb-4 border-b border-[color:var(--border-primary)]">
                        <Avatar className="h-14 w-14 mx-auto mb-3">
                          <AvatarFallback className="bg-[color:var(--bg-tertiary)] text-[color:var(--text-gold)] font-bold text-base">
                            {app.candidate?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <h4 className="font-bold text-[color:var(--text-primary)]">{app.candidate?.full_name}</h4>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--text-tertiary)] mb-1.5">{t("candidates.table.ai_score")}</p>
                        {app.ai_score !== null ? (
                          <ScoreBadge score={app.ai_score} size="sm" />
                        ) : (
                          <span className="text-sm text-[color:var(--text-tertiary)]">{t("common.not_scored")}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--text-tertiary)] mb-1.5">{t("common.ai_reasoning")}</p>
                        <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed">{app.ai_reasoning || t("common.not_available")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--text-tertiary)] mb-1.5">{t("candidates.table.experience")}</p>
                        <p className="text-sm text-[color:var(--text-secondary)]">
                          {app.candidate?.experience_years != null
                            ? `${app.candidate.experience_years} ${t("candidates.years")}`
                            : t("common.not_available")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--text-tertiary)] mb-1.5">{t("profile.skills")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {app.candidate?.skills && app.candidate.skills.length > 0 ? (
                            app.candidate.skills.map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs shadow-sm border border-[color:var(--bg-tertiary)]">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-[color:var(--text-tertiary)]">{t("common.not_available")}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--text-tertiary)] mb-1.5">{t("profile.education")}</p>
                        <p className="text-sm text-[color:var(--text-secondary)]">{app.candidate?.education || t("common.not_available")}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
        <Dialog open={editOpen} onOpenChange={(v) => !v && setEditOpen(false)}>
          <DialogContent className="max-w-2xl rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t("common.edit")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("jobs.form.title")}</Label>
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
      </div>
    </div>
  );
}
