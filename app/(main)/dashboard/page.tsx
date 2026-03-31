/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { PageLoading } from "@/components/shared/loading";
import { ScoreBadge } from "@/components/shared/score-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Users, UserPlus, Calendar, CheckCircle, Briefcase, TrendingUp, AlertTriangle, ArrowUpRight, RefreshCw,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE, SCORE_COLORS } from "@/lib/chart-config";
import { getProfessionLabel } from "@/lib/i18n/profession-labels";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  new: "#8A7D6B", reviewed: "#1A56A8", shortlisted: "#8A6D1B",
  interview_scheduled: "#5B3F9E", interviewed: "#5B3F9E",
  approved: "#2D7A3E", rejected: "#A32D2D", keep_for_future: "#8A7D6B",
  scored: "#C9A84C",
};

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setLastUpdated(new Date().toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [locale]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Refresh on tab visibility change
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [fetchData]);

  const MONTH_NAMES_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

  const getMonthLabel = (monthKey: string) => {
    const [, m] = monthKey.split("-");
    const idx = parseInt(m) - 1;
    if (locale === "he") return MONTH_NAMES_HE[idx] || monthKey;
    return new Date(2024, idx).toLocaleString("en-US", { month: "short" });
  };

  const labels = {
    he: {
      title: "דשבורד", subtitle: "סקירה כללית של תהליך הגיוס",
      total: "סה״כ מועמדים", new_week: "חדשים השבוע", interviews: "ראיונות מתוכננים",
      approved: "אושרו החודש", active_jobs: "משרות פעילות", avg_score: "ציון AI ממוצע",
      pipeline: "מצב Pipeline", professions: "חלוקה לפי מקצוע",
      scores: "התפלגות ציונים", timeline: "מגמת העלאות",
      top_jobs: "משרות מובילות", recent: "מועמדים אחרונים",
      activity: "פעילות אחרונה", no_data: "אין נתונים",
      candidates: "מועמדים", top_score: "ציון מקסימלי",
      messages: "הודעות החודש", files: "קבצים לא משויכים",
      updated: "עודכן", refresh: "רענן",
    },
    en: {
      title: "Dashboard", subtitle: "Recruitment pipeline overview",
      total: "Total Candidates", new_week: "New This Week", interviews: "Interviews Scheduled",
      approved: "Approved This Month", active_jobs: "Active Jobs", avg_score: "Avg AI Score",
      pipeline: "Pipeline Status", professions: "By Profession",
      scores: "Score Distribution", timeline: "Upload Trend",
      top_jobs: "Top Jobs", recent: "Recent Candidates",
      activity: "Recent Activity", no_data: "No data",
      candidates: "candidates", top_score: "Top Score",
      messages: "Messages This Month", files: "Unmatched Files",
      updated: "Updated", refresh: "Refresh",
    },
    tl: {
      title: "Dashboard", subtitle: "Pangkalahatang-ideya ng recruitment",
      total: "Kabuuang Kandidato", new_week: "Bago Ngayong Linggo", interviews: "Nakatakdang Panayam",
      approved: "Naaprubahan Ngayong Buwan", active_jobs: "Mga Aktibong Trabaho", avg_score: "Average AI Score",
      pipeline: "Status ng Pipeline", professions: "Ayon sa Propesyon",
      scores: "Distribusyon ng Score", timeline: "Trend ng Upload",
      top_jobs: "Mga Nangungunang Trabaho", recent: "Kamakailang Kandidato",
      activity: "Kamakailang Aktibidad", no_data: "Walang data",
      candidates: "kandidato", top_score: "Pinakamataas na Score",
      messages: "Mga Mensahe Ngayong Buwan", files: "Hindi Naitugmang File",
      updated: "Na-update", refresh: "I-refresh",
    },
  };
  const l = labels[locale] || labels.he;

  if (loading) return <PageLoading />;
  if (!data) return <div className="p-8" style={{ color: "var(--text-tertiary)" }}>{l.no_data}</div>;

  const { cards, charts, top_jobs, recent_candidates, recent_activity } = data;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{l.title}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>{l.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{l.updated} {lastUpdated}</span>
          <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={fetchData}>
            <RefreshCw className="h-3 w-3 mr-1" /> {l.refresh}
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Users, label: l.total, value: cards.total_candidates, color: "var(--brand-gold)" },
            { icon: UserPlus, label: l.new_week, value: cards.new_this_week, color: "var(--status-approved-text)" },
            { icon: Briefcase, label: l.active_jobs, value: cards.active_jobs, color: "var(--status-interview-text)" },
            { icon: Calendar, label: l.interviews, value: cards.interviews_scheduled, color: "var(--status-shortlisted-text)" },
            { icon: CheckCircle, label: l.approved, value: cards.approved_this_month, color: "var(--status-approved-text)" },
            { icon: TrendingUp, label: l.avg_score, value: cards.avg_ai_score, color: "var(--brand-gold)" },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-tertiary)" }}>
                  <kpi.icon className="h-4 w-4" style={{ color: kpi.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{kpi.value}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{kpi.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {(cards.unmatched_files > 0) && (
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-primary)" }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "var(--brand-gold)" }} />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>{cards.unmatched_files} {l.files}</span>
            </div>
            <Link href="/files"><Button size="sm" variant="outline" className="rounded-lg text-xs">{locale === "he" ? "צפה" : "View"}</Button></Link>
          </div>
        )}

        {/* Charts Row 1: Pipeline + Professions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: "var(--text-primary)" }}>{l.pipeline}</h3>
            {charts.status_breakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={charts.status_breakdown.map((d: any) => ({ ...d, name: t(`candidates.status.${d.status}`) || d.status }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid {...GRID_STYLE} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} {...AXIS_STYLE} />
                  <YAxis type="category" dataKey="name" width={100} {...AXIS_STYLE} tick={{ ...AXIS_STYLE.tick, fontSize: 11 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                    {charts.status_breakdown.map((e: any, i: number) => <Cell key={i} fill={STATUS_COLORS[e.status] || "#8A7D6B"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>{l.no_data}</p>}
          </div>

          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: "var(--text-primary)" }}>{l.professions}</h3>
            {charts.profession_breakdown?.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(220, charts.profession_breakdown.length * 28)}>
                <BarChart data={charts.profession_breakdown.map((d: any) => ({ ...d, name: getProfessionLabel(d.profession, locale) }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid {...GRID_STYLE} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} {...AXIS_STYLE} />
                  <YAxis type="category" dataKey="name" width={120} {...AXIS_STYLE} tick={{ ...AXIS_STYLE.tick, fontSize: 10 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="var(--brand-gold)" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>{l.no_data}</p>}
          </div>
        </div>

        {/* Charts Row 2: Scores + Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: "var(--text-primary)" }}>{l.scores}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={charts.score_distribution || []}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="range" {...AXIS_STYLE} />
                <YAxis allowDecimals={false} {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                  {(charts.score_distribution || []).map((_: any, i: number) => (
                    <Cell key={i} fill={[SCORE_COLORS.low, SCORE_COLORS.medium, SCORE_COLORS.high, SCORE_COLORS.top][i] || "#8A7D6B"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: "var(--text-primary)" }}>{l.timeline}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={(charts.monthly_timeline || []).map((d: any) => ({ ...d, name: getMonthLabel(d.month) }))}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="name" {...AXIS_STYLE} />
                <YAxis allowDecimals={false} {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="var(--brand-gold)" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom: Jobs + Recent + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Jobs */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{l.top_jobs}</h3>
              <Link href="/jobs"><ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} /></Link>
            </div>
            {(top_jobs || []).length > 0 ? (
              <div className="space-y-2">
                {top_jobs.map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between p-2 rounded-lg transition-colors" style={{ borderLeft: "3px solid var(--brand-gold)" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{job.title}</p>
                      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{job.candidate_count} {l.candidates}</p>
                    </div>
                    {job.top_score != null && job.top_score > 0 && <ScoreBadge score={job.top_score} size="sm" />}
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>{l.no_data}</p>}
          </div>

          {/* Recent Candidates */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{l.recent}</h3>
              <Link href="/candidates"><ArrowUpRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} /></Link>
            </div>
            <div className="space-y-2">
              {(recent_candidates || []).map((c: any) => (
                <Link key={c.id} href={`/candidates/${c.id}`} className="flex items-center justify-between p-2 rounded-lg transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.full_name}</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{getProfessionLabel(c.profession, locale)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <h3 className="font-bold text-sm mb-4" style={{ color: "var(--text-primary)" }}>{l.activity}</h3>
            <div className="space-y-2">
              {(recent_activity || []).slice(0, 10).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 p-1">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--brand-gold)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: "var(--text-primary)" }}>{a.candidate?.full_name || ""}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {t(`candidates.status.${a.action}`) || a.action} • {a.created_at ? formatDateTime(a.created_at) : ""}
                    </p>
                  </div>
                </div>
              ))}
              {(!recent_activity || recent_activity.length === 0) && (
                <p className="text-sm text-center py-4" style={{ color: "var(--text-tertiary)" }}>{l.no_data}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
