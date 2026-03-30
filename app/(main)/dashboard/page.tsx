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
  new: "#94A3B8", reviewed: "#C9A84C", shortlisted: "#8B5CF6",
  interview_scheduled: "#F59E0B", interviewed: "#6366F1",
  approved: "#10B981", rejected: "#EF4444", keep_for_future: "#14B8A6",
  scored: "#C9A84C",
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

  const COLORS = ["#C9A84C", "#A38A3E", "#D4B95E", "#8B7633", "#E5CA6E", "#6B5A28", "#F0DC85", "#4D4020"];

  const today = new Date().toLocaleDateString(locale === "he" ? "he-IL" : locale === "tl" ? "fil-PH" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border-primary)' }} className="px-8 py-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{l.title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{today}</p>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Users, label: l.total, value: totalCandidates, highlight: true },
            { icon: UserPlus, label: l.new_week, value: newThisWeek, highlight: false },
            { icon: Briefcase, label: l.active_jobs, value: activeJobs, highlight: false },
            { icon: Calendar, label: l.interviews, value: interviewCount, highlight: false },
            { icon: CheckCircle, label: l.approved, value: approvedCount, highlight: false },
            { icon: TrendingUp, label: l.rejected, value: rejectedCount, highlight: false },
          ].map((kpi, i) => (
            <div
              key={i}
              className="rounded-xl p-5"
              style={{
                background: 'var(--bg-card)',
                border: '0.5px solid var(--border-primary)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <p className="text-xs uppercase tracking-wider mt-2" style={{ color: 'var(--text-tertiary)' }}>
                {kpi.label}
              </p>
              <p
                className="text-2xl font-semibold mt-1"
                style={{ color: kpi.highlight ? 'var(--text-gold)' : 'var(--text-primary)' }}
              >
                {kpi.value}
              </p>
              {kpi.highlight && newThisWeek > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-gold)' }}>
                  +{newThisWeek} this week
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Alerts */}
        {(unclassified > 0 || noScore > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unclassified > 0 && (
              <div
                className="flex items-center justify-between p-4 rounded-xl"
                style={{
                  background: 'rgba(201, 168, 76, 0.08)',
                  border: '0.5px solid var(--brand-gold)',
                }}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5" style={{ color: 'var(--brand-gold)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{unclassified} {l.unclassified_alert}</p>
                  </div>
                </div>
                <Link href="/candidates">
                  <Button size="sm" variant="outline" className="rounded-lg text-xs" style={{ borderColor: 'var(--brand-gold)', color: 'var(--text-gold)' }}>{l.reclassify}</Button>
                </Link>
              </div>
            )}
            {noScore > 0 && (
              <div
                className="flex items-center justify-between p-4 rounded-xl"
                style={{
                  background: 'rgba(201, 168, 76, 0.05)',
                  border: '0.5px solid var(--border-primary)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5" style={{ color: 'var(--text-gold)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{noScore} {l.no_score_alert}</p>
                </div>
                <Link href="/candidates">
                  <Button size="sm" variant="outline" className="rounded-lg text-xs" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-gold)' }}>{l.analyze}</Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Status */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{l.pipeline}</h3>
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
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>{l.no_data}</p>}
          </div>

          {/* Profession Distribution */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{l.categories}</h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>{l.no_data}</p>}
          </div>
        </div>

        {/* Score Distribution + Top 5 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Distribution */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{l.scores}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreRanges}>
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {scoreRanges.map((_, i) => <Cell key={i} fill={i < 2 ? "#EF4444" : i < 3 ? "#F59E0B" : "#C9A84C"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 5 */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{l.top5}</h3>
            {topCandidates.length > 0 ? (
              <div className="space-y-3">
                {topCandidates.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/candidates/${c.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                    style={{ borderBottom: '0.5px solid var(--border-light)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: i === 0 ? '#C9A84C' : i < 3 ? '#B0B0B0' : 'var(--bg-tertiary)',
                        color: i === 0 ? '#1A1A1A' : i < 3 ? '#1A1A1A' : 'var(--text-secondary)',
                      }}
                    >
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.full_name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {(c.job_categories || []).slice(0, 2).join(", ").replace(/_/g, " ") || "—"}
                      </p>
                    </div>
                    <ScoreBadge score={c.topScore} size="sm" />
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>{l.no_data}</p>}
          </div>
        </div>

        {/* Jobs Overview + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Jobs Overview */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{l.job_overview}</h3>
              <Link href="/jobs"><Button variant="ghost" size="sm" className="text-xs rounded-lg gap-1" style={{ color: 'var(--text-gold)' }}><ArrowUpRight className="h-3 w-3" /></Button></Link>
            </div>
            {jobs.length > 0 ? (
              <div className="space-y-3">
                {jobs.slice(0, 5).map((job: any) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between p-3 rounded-lg transition-colors"
                    style={{
                      borderLeft: job.status === 'active' ? '3px solid var(--brand-gold)' : '3px solid transparent',
                      borderBottom: '0.5px solid var(--border-light)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{job.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{job.department || ""} {job.location ? `• ${job.location}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {job.candidate_count || 0} {l.candidates_label}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>{l.no_data}</p>}
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{l.activity}</h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg">
                    <div className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--brand-gold)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {(activity as any).candidate?.full_name || ""}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {t(`candidates.status.${activity.action}`) || activity.action}
                      </p>
                    </div>
                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                      {activity.created_at ? formatDateTime(activity.created_at) : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>{l.no_data}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
