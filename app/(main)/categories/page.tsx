"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScoreBadge } from "@/components/shared/score-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, CartesianGrid } from "recharts";
import { Users, TrendingUp, Award, Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Category {
  key: string;
  name_he: string;
  name_en: string;
  name_tl: string;
  parent_key: string | null;
}

interface CandidateData {
  id: string;
  full_name: string;
  email: string;
  status: string;
  experience_years: number;
  skills: string[];
  education: string;
  job_categories: string[];
  ai_analysis: Record<string, unknown> | null;
  applications: { ai_score: number | null; job: { title: string } | null }[];
  created_at: string;
}

export default function CategoriesPage() {
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    setLoading(true);
    fetch(`/api/candidates?category=${selectedCategory}&limit=100`)
      .then(r => r.json())
      .then(d => setCandidates(d.candidates || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCategory]);

  const getCatName = (cat: Category) => locale === "he" ? cat.name_he : locale === "tl" ? cat.name_tl : cat.name_en;
  const getCatNameByKey = (key: string) => {
    const cat = categories.find(c => c.key === key);
    return cat ? getCatName(cat) : key;
  };

  const getTopScore = (c: CandidateData) => {
    const scores = (c.applications || []).map(a => a.ai_score).filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.max(...scores) : null;
  };

  const avgScore = (() => {
    const scores = candidates.map(c => getTopScore(c)).filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  })();

  const avgExp = (() => {
    const exps = candidates.map(c => c.experience_years).filter(Boolean);
    return exps.length > 0 ? (exps.reduce((a, b) => a + b, 0) / exps.length).toFixed(1) : "0";
  })();

  const statusBreakdown = candidates.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const scoreDistribution = [
    { range: "0-20", count: 0 }, { range: "21-40", count: 0 },
    { range: "41-60", count: 0 }, { range: "61-80", count: 0 }, { range: "81-100", count: 0 },
  ];
  candidates.forEach(c => {
    const s = getTopScore(c);
    if (s !== null) {
      if (s <= 20) scoreDistribution[0].count++;
      else if (s <= 40) scoreDistribution[1].count++;
      else if (s <= 60) scoreDistribution[2].count++;
      else if (s <= 80) scoreDistribution[3].count++;
      else scoreDistribution[4].count++;
    }
  });

  const requestInsight = async () => {
    if (!selectedCategory || candidates.length === 0) return;
    setLoadingInsight(true);
    try {
      const res = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${t("categories.ai_prompt")} "${getCatNameByKey(selectedCategory)}". ${candidates.length} candidates, avg score: ${avgScore}, avg experience: ${avgExp}. IMPORTANT: Respond entirely in ${locale === "he" ? "Hebrew" : locale === "tl" ? "Tagalog" : "English"}. Do not mix languages.`,
        }),
      });
      const data = await res.json();
      setAiInsight(data.response || "");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoadingInsight(false);
    }
  };

  const labels = {
    he: { title: "ניתוח לפי מקצוע", select: "בחר מקצוע", total: "סה״כ מועמדים", avg_score: "ציון ממוצע", avg_exp: "ניסיון ממוצע", years: "שנים", scores: "התפלגות ציונים", status_chart: "סטטוס מועמדים", candidates_table: "טבלת מועמדים", ai_recommendations: "המלצות AI למנכ״ל", generate: "הפק המלצות", name: "שם", score: "ציון", exp: "ניסיון", status: "סטטוס", skills: "כישורים" },
    en: { title: "Analysis by Profession", select: "Select Profession", total: "Total Candidates", avg_score: "Avg Score", avg_exp: "Avg Experience", years: "years", scores: "Score Distribution", status_chart: "Candidate Status", candidates_table: "Candidates Table", ai_recommendations: "AI Recommendations for CEO", generate: "Generate Recommendations", name: "Name", score: "Score", exp: "Experience", status: "Status", skills: "Skills" },
    tl: { title: "Pagsusuri ayon sa Propesyon", select: "Pumili ng Propesyon", total: "Kabuuang Kandidato", avg_score: "Average Score", avg_exp: "Average na Karanasan", years: "taon", scores: "Distribusyon ng Score", status_chart: "Status ng Kandidato", candidates_table: "Talaan ng Kandidato", ai_recommendations: "Mga Rekomendasyon ng AI para sa CEO", generate: "Gumawa ng Rekomendasyon", name: "Pangalan", score: "Score", exp: "Karanasan", status: "Status", skills: "Mga Kasanayan" },
  };
  const l = labels[locale] || labels.he;

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6", "#EC4899", "#6366F1"];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      <div className="border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{l.title}</h1>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-64 rounded-lg" style={{ borderColor: 'var(--border-primary)' }}>
              <SelectValue placeholder={l.select} />
            </SelectTrigger>
            <SelectContent>
              {categories.filter(c => !c.parent_key).map(cat => (
                <SelectItem key={cat.key} value={cat.key}>
                  {getCatName(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedCategory ? (
        <div className="px-8 py-16 text-center">
          <Users className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--border-secondary)' }} />
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{l.select}</p>
        </div>
      ) : loading ? (
        <div className="px-8 py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: 'var(--brand-gold)' }} />
        </div>
      ) : (
        <div className="px-8 py-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                  <Users className="h-5 w-5" style={{ color: 'var(--brand-gold)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{candidates.length}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{l.total}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--green-light)' }}>
                  <Award className="h-5 w-5" style={{ color: 'var(--green)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{avgScore}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{l.avg_score}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--amber-light)' }}>
                  <TrendingUp className="h-5 w-5" style={{ color: 'var(--amber)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{avgExp} {l.years}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{l.avg_exp}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Score Distribution */}
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{l.scores}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-tertiary)" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {scoreDistribution.map((_, i) => (
                      <Cell key={i} fill={i < 2 ? "var(--red)" : i < 3 ? "var(--amber)" : "var(--green)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status Pie */}
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{l.status_chart}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={Object.entries(statusBreakdown).map(([status, count]) => ({ name: status, value: count }))}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                  >
                    {Object.keys(statusBreakdown).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Candidates Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="p-5 border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{l.candidates_table}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{l.name}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{l.score}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{l.exp}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{l.skills}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{l.status}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.sort((a, b) => (getTopScore(b) || 0) - (getTopScore(a) || 0)).map(c => (
                  <tr key={c.id} className="hover:bg-[color:var(--bg-secondary)]" style={{ borderBottom: '1px solid var(--bg-tertiary)' }}>
                    <td className="px-4 py-3">
                      <Link href={`/candidates/${c.id}`} className="font-medium hover:text-[color:var(--text-gold)]" style={{ color: 'var(--text-primary)' }}>
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{getTopScore(c) !== null ? <ScoreBadge score={getTopScore(c)!} size="sm" /> : "--"}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.experience_years || 0} {l.years}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(c.skills || []).slice(0, 3).map((s, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI Recommendations */}
          <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Brain className="h-5 w-5" style={{ color: 'var(--brand-gold)' }} />
                {l.ai_recommendations}
              </h3>
              <Button onClick={requestInsight} disabled={loadingInsight || candidates.length === 0} className="rounded-lg text-white" style={{ background: 'var(--brand-gold)' }}>
                {loadingInsight ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                {l.generate}
              </Button>
            </div>
            {aiInsight ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap p-4 rounded-lg" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                {aiInsight}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {t("categories.ai_hint")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
