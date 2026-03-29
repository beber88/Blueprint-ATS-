"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageLoading } from "@/components/shared/loading";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Zap, MapPin, Clock, Building, GitCompare, Users, FileText, BarChart3, Trophy, Table } from "lucide-react";
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

type TabKey = "table" | "charts" | "top";

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
      .catch(() => toast.error("שגיאה בטעינת משרה"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/jobs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setJob((prev) => prev ? { ...prev, status: status as Job["status"] } : null);
      toast.success("סטטוס המשרה עודכן");
    } catch {
      toast.error("שגיאה בעדכון משרה");
    }
  };

  const runBatchScoring = async () => {
    if (!job) return;
    setScoring(true);
    const unscored = job.applications.filter((a) => a.ai_score === null);

    if (unscored.length === 0) {
      toast.info("כל המועמדים כבר דורגו");
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
      toast.info(`מדרג: ${scored + failed}/${unscored.length}`, { id: "scoring-progress" });
    }

    if (failed > 0) {
      toast.warning(`דורגו ${scored} מועמדים, ${failed} נכשלו`);
    } else {
      toast.success(`דורגו ${scored} מועמדים בהצלחה`);
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
  if (!job) return <div className="p-6 text-center text-gray-500">משרה לא נמצאה</div>;

  const employmentTypeLabels: Record<string, string> = {
    "full-time": t("jobs.form.full_time"),
    "part-time": t("jobs.form.part_time"),
    contract: t("jobs.form.contract"),
    internship: t("jobs.form.internship"),
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "table", label: "טבלה", icon: <Table className="h-4 w-4" /> },
    { key: "charts", label: "גרפים", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "top", label: "TOP מועמדים", icon: <Trophy className="h-4 w-4" /> },
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

  const radarColors = ["var(--blue)", "var(--green)", "var(--amber)"];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header title={job.title} subtitle={job.department || "פרטי משרה"} />

      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-900 gap-2 rounded-xl px-3"
          >
            <ArrowRight className="h-4 w-4" />
            {t("common.back")}
          </Button>
          <div className="flex items-center gap-3">
            <Select value={job.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-36 rounded-xl bg-white shadow-sm border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("jobs.status.active")}</SelectItem>
                <SelectItem value="paused">{t("jobs.status.paused")}</SelectItem>
                <SelectItem value="closed">{t("jobs.status.closed")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={runBatchScoring}
              disabled={scoring}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm gap-2 px-5"
            >
              <Zap className="h-4 w-4" />
              {scoring ? "מדרג..." : "דירוג AI"}
            </Button>
          </div>
        </div>

        {/* Job Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  {job.department && (
                    <span className="flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-gray-400" />
                      {job.department}
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {job.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {employmentTypeLabels[job.employment_type] || job.employment_type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {(job.description || job.requirements) && (
            <div className="border-t border-gray-100 p-6 space-y-5">
              {job.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    {t("jobs.form.description")}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
              {job.requirements && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">{t("jobs.form.requirements")}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.requirements}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Candidates Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t("candidates.title")}</h2>
                <p className="text-sm text-gray-500">{candidates.length} מועמדויות</p>
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
                className={`rounded-xl gap-2 transition-colors ${compareMode ? "bg-blue-500 hover:bg-blue-600 text-white" : "border-gray-200"}`}
              >
                <GitCompare className="h-4 w-4" />
                {compareMode ? "ביטול השוואה" : "השוואה"}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {candidates.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">טרם הוגשו מועמדויות</p>
              <p className="text-sm text-gray-400 mt-1">מועמדים שיגישו מועמדות יופיעו כאן</p>
            </div>
          ) : (
            <>
              {/* TABLE TAB */}
              {activeTab === "table" && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-right">
                        {compareMode && <th className="py-3 px-4 w-12"></th>}
                        <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("candidates.table.candidate")}</th>
                        <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("candidates.table.ai_score")}</th>
                        <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("candidates.table.status")}</th>
                        <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("candidates.table.experience")}</th>
                        <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">תאריך הגשה</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {candidates.map((app) => (
                        <tr
                          key={app.id}
                          className={`hover:bg-gray-50/80 transition-colors ${
                            compareMode && selectedCandidates.has(app.id) ? "bg-blue-50/60" : ""
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
                                <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-semibold">
                                  {app.candidate?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <Link
                                href={`/candidates/${app.candidate_id}`}
                                className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                              >
                                {app.candidate?.full_name}
                              </Link>
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            {app.ai_score !== null ? (
                              <ScoreBadge score={app.ai_score} size="sm" />
                            ) : (
                              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">לא דורג</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5">
                            <StatusBadge status={app.status} />
                          </td>
                          <td className="py-3.5 px-5 text-sm text-gray-600">
                            {app.candidate?.experience_years != null
                              ? `${app.candidate.experience_years} ${t("candidates.years")}`
                              : "-"}
                          </td>
                          <td className="py-3.5 px-5 text-sm text-gray-500">
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
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">התפלגות ציונים</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={candidates.map((app) => ({
                          name: app.candidate?.full_name?.split(" ")[0] || "?",
                          score: app.ai_score || 0,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
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
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">
                      {t("candidates.table.experience")} מול ציון AI
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                        <XAxis dataKey="experience" name="Experience" unit="y" />
                        <YAxis dataKey="score" name="Score" domain={[0, 100]} />
                        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                        <Scatter
                          data={candidates.map((app) => ({
                            experience: app.candidate?.experience_years || 0,
                            score: app.ai_score || 0,
                            name: app.candidate?.full_name,
                          }))}
                          fill="var(--blue)"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart 3: Pipeline Status */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">פילוח לפי סטטוס</h3>
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
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">השוואת מובילים (Radar)</h3>
                    {radarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="var(--gray-100)" />
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
                      <div className="text-center py-10 text-sm text-gray-400">
                        אין מועמדים מדורגים להשוואה
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
                      <Trophy className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">אין מועמדים מדורגים עדיין</p>
                      <p className="text-sm text-gray-400 mt-1">הפעילו דירוג AI כדי לראות את המובילים</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {topCandidates.map((app, index) => (
                        <div
                          key={app.id}
                          className="flex items-center gap-5 bg-gray-50 rounded-xl p-5 border border-gray-100 hover:border-blue-200 transition-colors"
                        >
                          {/* Rank */}
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                              index === 0
                                ? "bg-amber-100 text-amber-700"
                                : index === 1
                                ? "bg-gray-200 text-gray-600"
                                : index === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-500"
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
                              className="font-bold text-gray-900 hover:text-blue-600 transition-colors text-lg"
                            >
                              {app.candidate?.full_name}
                            </Link>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              {app.candidate?.experience_years != null && (
                                <span>{app.candidate.experience_years} {t("candidates.years")} {t("candidates.table.experience")}</span>
                              )}
                              <StatusBadge status={app.status} />
                            </div>
                            {app.ai_reasoning && (
                              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{app.ai_reasoning}</p>
                            )}
                            {app.candidate?.skills && app.candidate.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {app.candidate.skills.slice(0, 6).map((skill) => (
                                  <Badge key={skill} variant="secondary" className="text-xs bg-white shadow-sm border border-gray-100">
                                    {skill}
                                  </Badge>
                                ))}
                                {app.candidate.skills.length > 6 && (
                                  <span className="text-xs text-gray-400 self-center">+{app.candidate.skills.length - 6}</span>
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-blue-500" />
                השוואת מועמדים
                <span className="text-sm font-normal text-gray-500">({selectedCandidates.size} נבחרו)</span>
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
                    <div key={app.id} className="bg-gray-50 rounded-xl p-5 space-y-4 border border-gray-100">
                      <div className="text-center pb-4 border-b border-gray-200">
                        <Avatar className="h-14 w-14 mx-auto mb-3">
                          <AvatarFallback className="bg-blue-100 text-blue-600 font-bold text-base">
                            {app.candidate?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <h4 className="font-bold text-gray-900">{app.candidate?.full_name}</h4>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">{t("candidates.table.ai_score")}</p>
                        {app.ai_score !== null ? (
                          <ScoreBadge score={app.ai_score} size="sm" />
                        ) : (
                          <span className="text-sm text-gray-400">לא דורג</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">נימוק AI</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{app.ai_reasoning || "לא זמין"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">{t("candidates.table.experience")}</p>
                        <p className="text-sm text-gray-700">
                          {app.candidate?.experience_years != null
                            ? `${app.candidate.experience_years} ${t("candidates.years")}`
                            : "לא זמין"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">{t("profile.skills")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {app.candidate?.skills && app.candidate.skills.length > 0 ? (
                            app.candidate.skills.map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs bg-white shadow-sm border border-gray-100">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">לא זמין</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">{t("profile.education")}</p>
                        <p className="text-sm text-gray-700">{app.candidate?.education || "לא זמין"}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
