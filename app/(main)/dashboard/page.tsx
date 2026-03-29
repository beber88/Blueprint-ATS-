/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { PageLoading } from "@/components/shared/loading";
import { ScoreBadge } from "@/components/shared/score-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Users, UserPlus, Calendar, CheckCircle, Briefcase, TrendingUp, AlertTriangle, ArrowUpRight, Brain,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import Link from "next/link";
import { DashboardStats } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  new: "#94A3B8", reviewed: "#3B82F6", shortlisted: "#8B5CF6",
  interview_scheduled: "#F59E0B", interviewed: "#6366F1",
  approved: "#10B981", rejected: "#EF4444", keep_for_future: "#14B8A6",
  scored: "#06B6D4",
};

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then(r => r.json()),
      fetch("/api/candidates?limit=100").then(r => r.json()),
      fetch("/api/jobs").then(r => r.json()),
    ]).then(([s, c, j]) => {
      setStats(s);
      setCandidates(c.candidates || []);
      setJobs(j || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoading />;

  // Compute real metrics
  const totalCandidates = candidates.length;
  const newThisWeek = candidates.filter(c => {
    const d = new Date(c.created_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const activeJobs = jobs.filter((j: any) => j.status === "active").length;
  const approvedCount = candidates.filter(c => c.status === "approved").length;
  const interviewCount = candidates.filter(c => c.status === "interview_scheduled").length;
  const rejectedCount = candidates.filter(c => c.status === "rejected").length;
  const unclassified = candidates.filter(c => !c.job_categories || c.job_categories.length === 0).length;
  const noScore = candidates.filter(c => {
    const apps = c.applications || [];
    return apps.every((a: any) => !a.ai_score) && !c.ai_analysis;
  }).length;

  // Status breakdown
  const statusData = Object.entries(
    candidates.reduce((acc: Record<string, number>, c: any) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ status, count: count as number }));

  // Category breakdown
  const catCounts: Record<string, number> = {};
  candidates.forEach((c: any) => {
    ((c.job_categories as string[]) || []).forEach(cat => { catCounts[cat] = (catCounts[cat] || 0) + 1; });
  });
  const categoryData = Object.entries(catCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  // Score distribution
  const scoreRanges = [
    { range: "0-20", count: 0 }, { range: "21-40", count: 0 },
    { range: "41-60", count: 0 }, { range: "61-80", count: 0 }, { range: "81-100", count: 0 },
  ];
  candidates.forEach((c: any) => {
    const score = c.ai_analysis?.total_score || c.ai_analysis?.verdict?.score;
    if (score) {
      if (score <= 20) scoreRanges[0].count++;
      else if (score <= 40) scoreRanges[1].count++;
      else if (score <= 60) scoreRanges[2].count++;
      else if (score <= 80) scoreRanges[3].count++;
      else scoreRanges[4].count++;
    }
  });

  // Top candidates (by score)
  const topCandidates = [...candidates]
    .map(c => ({
      ...c,
      topScore: c.ai_analysis?.total_score || c.ai_analysis?.verdict?.score || (c.applications || []).reduce((max: number, a: any) => Math.max(max, a.ai_score || 0), 0) || null,
    }))
    .filter(c => c.topScore && c.topScore > 0)
    .sort((a, b) => (b.topScore || 0) - (a.topScore || 0))
    .slice(0, 5);

  // Recent activity
  const recentActivity = (stats?.recent_activity || []).slice(0, 8);

  const labels = {
    he: {
      title: "דשבורד", subtitle: "סקירה כללית של תהליך הגיוס",
      total: "סה״כ מועמדים", new_week: "חדשים השבוע", active_jobs: "משרות פתוחות",
      approved: "אושרו", interviews: "ראיונות מתוכננים", rejected: "נדחו",
      pipeline: "מצב Pipeline", categories: "חלוקה לפי מקצוע",
      scores: "התפלגות ציונים", top5: "TOP 5 מועמדים",
      activity: "פעילות אחרונה", attention: "דורש תשומת לב",
      unclassified_alert: "מועמדים ללא סיווג מקצועי",
      no_score_alert: "מועמדים ללא ניתוח AI",
      reclassify: "סווג עכשיו", analyze: "נתח עכשיו",
      job_overview: "סקירת משרות", candidates_label: "מועמדים",
      top_score: "ציון מקסימלי", no_data: "אין נתונים",
    },
    en: {
      title: "Dashboard", subtitle: "Recruitment pipeline overview",
      total: "Total Candidates", new_week: "New This Week", active_jobs: "Open Jobs",
      approved: "Approved", interviews: "Interviews Scheduled", rejected: "Rejected",
      pipeline: "Pipeline Status", categories: "By Profession",
      scores: "Score Distribution", top5: "TOP 5 Candidates",
      activity: "Recent Activity", attention: "Needs Attention",
      unclassified_alert: "Candidates without profession classification",
      no_score_alert: "Candidates without AI analysis",
      reclassify: "Classify Now", analyze: "Analyze Now",
      job_overview: "Jobs Overview", candidates_label: "Candidates",
      top_score: "Top Score", no_data: "No data",
    },
    tl: {
      title: "Dashboard", subtitle: "Pangkalahatang-ideya ng recruitment",
      total: "Kabuuang Kandidato", new_week: "Bago Ngayong Linggo", active_jobs: "Bukas na Trabaho",
      approved: "Naaprubahan", interviews: "Nakatakdang Panayam", rejected: "Tinanggihan",
      pipeline: "Status ng Pipeline", categories: "Ayon sa Propesyon",
      scores: "Distribusyon ng Score", top5: "TOP 5 Kandidato",
      activity: "Kamakailang Aktibidad", attention: "Nangangailangan ng Atensyon",
      unclassified_alert: "Mga kandidato na walang klasipikasyon",
      no_score_alert: "Mga kandidato na walang AI analysis",
      reclassify: "I-classify Ngayon", analyze: "I-analyze Ngayon",
      job_overview: "Pangkalahatang-ideya ng Trabaho", candidates_label: "Kandidato",
      top_score: "Pinakamataas na Score", no_data: "Walang data",
    },
  };
  const l = labels[locale] || labels.he;

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6", "#EC4899", "#6366F1"];

  return (
    <div className="min-h-screen" style={{ background: 'var(--gray-50)' }}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b px-8 py-6" style={{ borderColor: 'var(--gray-200)' }}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>{l.title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{l.subtitle}</p>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI Cards Row 1 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Users, label: l.total, value: totalCandidates, color: "var(--blue)", bg: "var(--blue-light)" },
            { icon: UserPlus, label: l.new_week, value: newThisWeek, color: "var(--green)", bg: "var(--green-light)" },
            { icon: Briefcase, label: l.active_jobs, value: activeJobs, color: "var(--purple)", bg: "var(--purple-light)" },
            { icon: Calendar, label: l.interviews, value: interviewCount, color: "var(--amber)", bg: "var(--amber-light)" },
            { icon: CheckCircle, label: l.approved, value: approvedCount, color: "var(--green)", bg: "var(--green-light)" },
            { icon: TrendingUp, label: l.rejected, value: rejectedCount, color: "var(--red)", bg: "var(--red-light)" },
          ].map((kpi, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: kpi.bg }}>
                  <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>{kpi.value}</p>
                  <p className="text-xs" style={{ color: 'var(--gray-400)' }}>{kpi.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {(unclassified > 0 || noScore > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unclassified > 0 && (
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)' }}>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5" style={{ color: 'var(--amber)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>{unclassified} {l.unclassified_alert}</p>
                  </div>
                </div>
                <Link href="/candidates">
                  <Button size="sm" variant="outline" className="rounded-lg text-xs">{l.reclassify}</Button>
                </Link>
              </div>
            )}
            {noScore > 0 && (
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)' }}>
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5" style={{ color: 'var(--blue)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>{noScore} {l.no_score_alert}</p>
                </div>
                <Link href="/candidates">
                  <Button size="sm" variant="outline" className="rounded-lg text-xs">{l.analyze}</Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Status */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--navy)' }}>{l.pipeline}</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={statusData} layout="vertical">
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="status" width={100} tick={{ fontSize: 11 }} tickFormatter={(v) => t(`candidates.status.${v}`) || v} />
                  <Tooltip formatter={(value) => [value, l.candidates_label]} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] || "#94A3B8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--gray-400)' }}>{l.no_data}</p>}
          </div>

          {/* Profession Distribution */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--navy)' }}>{l.categories}</h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--gray-400)' }}>{l.no_data}</p>}
          </div>
        </div>

        {/* Score Distribution + Top 5 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Distribution */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--navy)' }}>{l.scores}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreRanges}>
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {scoreRanges.map((_, i) => <Cell key={i} fill={i < 2 ? "var(--red)" : i < 3 ? "var(--amber)" : "var(--green)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 5 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--navy)' }}>{l.top5}</h3>
            {topCandidates.length > 0 ? (
              <div className="space-y-3">
                {topCandidates.map((c, i) => (
                  <Link key={c.id} href={`/candidates/${c.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: i === 0 ? 'var(--amber)' : i < 3 ? 'var(--gray-200)' : 'var(--gray-100)', color: i === 0 ? '#fff' : 'var(--gray-600)' }}>
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--navy)' }}>{c.full_name}</p>
                      <p className="text-xs" style={{ color: 'var(--gray-400)' }}>
                        {(c.job_categories || []).slice(0, 2).join(", ").replace(/_/g, " ") || "—"}
                      </p>
                    </div>
                    <ScoreBadge score={c.topScore} size="sm" />
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--gray-400)' }}>{l.no_data}</p>}
          </div>
        </div>

        {/* Jobs Overview + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Jobs Overview */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'var(--navy)' }}>{l.job_overview}</h3>
              <Link href="/jobs"><Button variant="ghost" size="sm" className="text-xs rounded-lg gap-1"><ArrowUpRight className="h-3 w-3" /></Button></Link>
            </div>
            {jobs.length > 0 ? (
              <div className="space-y-3">
                {jobs.slice(0, 5).map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--navy)' }}>{job.title}</p>
                      <p className="text-xs" style={{ color: 'var(--gray-400)' }}>{job.department || ""} {job.location ? `• ${job.location}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium" style={{ color: 'var(--gray-600)' }}>
                        {job.candidate_count || 0} {l.candidates_label}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--gray-400)' }}>{l.no_data}</p>}
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--navy)' }}>{l.activity}</h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg">
                    <div className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--blue)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--navy)' }}>
                        {(activity as any).candidate?.full_name || ""}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--gray-400)' }}>
                        {t(`candidates.status.${activity.action}`) || activity.action}
                      </p>
                    </div>
                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--gray-400)' }}>
                      {activity.created_at ? formatDateTime(activity.created_at) : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--gray-400)' }}>{l.no_data}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
