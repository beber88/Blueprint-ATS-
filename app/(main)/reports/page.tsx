/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { getProfessionLabel } from "@/lib/i18n/profession-labels";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TOOLTIP_STYLE, AXIS_STYLE } from "@/lib/chart-config";
import Link from "next/link";
import { FileBarChart, Loader2, RefreshCw, AlertTriangle, Users, Calendar, MessageSquare, Briefcase, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  new: "#8A7D6B", reviewed: "#1A56A8", shortlisted: "#8A6D1B",
  interview_scheduled: "#5B3F9E", approved: "#2D7A3E", rejected: "#A32D2D",
};

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [showSummary, setShowSummary] = useState(true);

  const labels = {
    he: {
      title: "דוח שבועי למנכ\"ל", period: "תקופה", last_week: "שבוע", two_weeks: "שבועיים", month: "חודש",
      generate: "הפק דוח", regenerate: "הפק מחדש", generating: "מפיק דוח...",
      ai_summary: "סיכום מנהלים (AI)", new_candidates: "מועמדים חדשים", total: "סה״כ",
      avg_score: "ציון ממוצע", interviews: "ראיונות בתקופה", messages: "הודעות נשלחו",
      open_positions: "משרות פתוחות", with_portfolio: "עם תיק עבודות",
      by_category: "המלצות לפי מקצוע", top_candidates: "מועמדים מובילים",
      pipeline: "סטטוס צנרת הגיוס", actions: "פעולות נדרשות",
      rank: "דירוג", name: "שם", profession: "מקצוע", score: "ציון",
      experience: "ניסיון", status: "סטטוס", new_count: "חדשים",
      view_all: "צפה בכולם", no_data: "אין נתונים לתקופה זו",
    },
    en: {
      title: "Weekly CEO Report", period: "Period", last_week: "Week", two_weeks: "2 Weeks", month: "Month",
      generate: "Generate Report", regenerate: "Regenerate", generating: "Generating report...",
      ai_summary: "Executive Summary (AI)", new_candidates: "New Candidates", total: "Total",
      avg_score: "Avg Score", interviews: "Interviews", messages: "Messages Sent",
      open_positions: "Open Positions", with_portfolio: "With Portfolio",
      by_category: "Recommendations by Category", top_candidates: "Top Candidates",
      pipeline: "Recruitment Pipeline", actions: "Action Items",
      rank: "Rank", name: "Name", profession: "Profession", score: "Score",
      experience: "Experience", status: "Status", new_count: "new",
      view_all: "View all", no_data: "No data for this period",
    },
    tl: {
      title: "Lingguhang Ulat sa CEO", period: "Panahon", last_week: "Linggo", two_weeks: "2 Linggo", month: "Buwan",
      generate: "Gumawa ng Ulat", regenerate: "Gumawa Muli", generating: "Gumagawa ng ulat...",
      ai_summary: "Executive Summary (AI)", new_candidates: "Bagong Kandidato", total: "Kabuuan",
      avg_score: "Average Score", interviews: "Mga Panayam", messages: "Mga Naipadala na Mensahe",
      open_positions: "Bukas na Posisyon", with_portfolio: "May Portfolio",
      by_category: "Mga Rekomendasyon", top_candidates: "Mga Nangungunang Kandidato",
      pipeline: "Pipeline ng Recruitment", actions: "Mga Aksyon",
      rank: "Ranggo", name: "Pangalan", profession: "Propesyon", score: "Score",
      experience: "Karanasan", status: "Status", new_count: "bago",
      view_all: "Tingnan lahat", no_data: "Walang data para sa panahong ito",
    },
  };
  const l = labels[locale] || labels.he;

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, lang: locale }),
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="px-8 py-6" style={{ borderBottom: "1px solid var(--border-primary)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileBarChart className="h-6 w-6" style={{ color: "var(--brand-gold)" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{l.title}</h1>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{l.period}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[{ d: 7, label: l.last_week }, { d: 14, label: l.two_weeks }, { d: 30, label: l.month }].map(p => (
              <button key={p.d} onClick={() => setDays(p.d)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: days === p.d ? "var(--brand-gold)" : "var(--bg-tertiary)", color: days === p.d ? "#1A1A1A" : "var(--text-secondary)" }}>
                {p.label}
              </button>
            ))}
            <Button onClick={generateReport} disabled={loading} className="rounded-lg text-sm" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{l.generating}</> : <><RefreshCw className="h-4 w-4 mr-1" />{data ? l.regenerate : l.generate}</>}
            </Button>
          </div>
        </div>
      </div>

      {!data && !loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FileBarChart className="h-16 w-16 mx-auto mb-4" style={{ color: "var(--text-tertiary)" }} />
            <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{l.generate}</p>
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{l.no_data}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="px-8 py-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { icon: Users, label: l.new_candidates, value: data.summary.new_candidates },
              { icon: Users, label: l.total, value: data.summary.total_candidates },
              { icon: Calendar, label: l.interviews, value: data.summary.interviews },
              { icon: MessageSquare, label: l.messages, value: data.summary.messages },
              { icon: Briefcase, label: l.open_positions, value: data.summary.open_positions },
              { icon: FileBarChart, label: l.avg_score, value: data.summary.avg_score },
              { icon: FileBarChart, label: l.with_portfolio, value: data.summary.with_portfolio },
            ].map((card, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
                <card.icon className="h-4 w-4 mb-1" style={{ color: "var(--brand-gold)" }} />
                <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{card.value}</p>
                <p className="text-[10px] uppercase" style={{ color: "var(--text-tertiary)" }}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* AI Summary */}
          {data.ai_summary && (
            <div className="rounded-xl" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
              <button onClick={() => setShowSummary(!showSummary)} className="w-full flex items-center justify-between p-5">
                <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{l.ai_summary}</h3>
                {showSummary ? <ChevronUp className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />}
              </button>
              {showSummary && (
                <div className="px-5 pb-5">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{data.ai_summary}</div>
                </div>
              )}
            </div>
          )}

          {/* Category Cards + Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
              <h3 className="font-bold text-sm mb-4" style={{ color: "var(--text-primary)" }}>{l.by_category}</h3>
              <div className="space-y-3">
                {(data.by_profession || []).filter((p: any) => p.key !== "other").slice(0, 6).map((prof: any) => (
                  <div key={prof.key} className="p-3 rounded-lg" style={{ background: "var(--bg-secondary)", borderLeft: "3px solid var(--brand-gold)" }}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{getProfessionLabel(prof.key, locale)}</span>
                      <div className="flex gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        <span>{prof.count} {l.total}</span>
                        {prof.newCount > 0 && <span className="font-bold" style={{ color: "var(--brand-gold)" }}>+{prof.newCount} {l.new_count}</span>}
                      </div>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                      {l.avg_score}: {prof.avgScore} | {l.with_portfolio}: {prof.withPortfolio}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline */}
            <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
              <h3 className="font-bold text-sm mb-4" style={{ color: "var(--text-primary)" }}>{l.pipeline}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={(data.pipeline || []).map((d: any) => ({ ...d, name: t(`candidates.status.${d.status}`) || d.status }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} {...AXIS_STYLE} />
                  <YAxis type="category" dataKey="name" width={100} {...AXIS_STYLE} tick={{ ...AXIS_STYLE.tick, fontSize: 11 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                    {(data.pipeline || []).map((e: any, i: number) => <Cell key={i} fill={STATUS_COLORS[e.status] || "#8A7D6B"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Candidates */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <div className="p-5 border-b" style={{ borderColor: "var(--border-primary)" }}>
              <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{l.top_candidates}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-tertiary)" }}>
                  {[l.rank, l.name, l.profession, l.score, l.experience, l.status].map(h => (
                    <th key={h} className="text-right px-4 py-2 text-xs" style={{ color: "var(--text-tertiary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.top_candidates || []).map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: "0.5px solid var(--border-light)" }}>
                    <td className="px-4 py-2 font-bold" style={{ color: c.rank <= 3 ? "var(--brand-gold)" : "var(--text-tertiary)" }}>#{c.rank}</td>
                    <td className="px-4 py-2"><Link href={`/candidates/${c.id}`} className="font-medium" style={{ color: "var(--text-primary)" }}>{c.full_name}</Link></td>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{getProfessionLabel(c.profession, locale)}</td>
                    <td className="px-4 py-2">{c.overall_ai_score ? <ScoreBadge score={c.overall_ai_score} size="sm" /> : "—"}</td>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{c.experience_years || 0}y</td>
                    <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Items */}
          {data.action_items?.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--status-shortlisted-text)" }}>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <AlertTriangle className="h-4 w-4" style={{ color: "var(--status-shortlisted-text)" }} /> {l.actions}
              </h3>
              <ul className="space-y-2">
                {data.action_items.map((item: string, i: number) => (
                  <li key={i} className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--status-shortlisted-text)" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
