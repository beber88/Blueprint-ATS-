/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { translateSkill, translateExperience } from "@/lib/i18n/content-translations";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from "@/lib/chart-config";
import { Users, AlertTriangle, FolderOpen, Loader2, Award } from "lucide-react";
import { toast } from "sonner";

interface ProfessionData {
  key: string;
  count: number;
  avgExperience: number;
  statusBreakdown: Record<string, number>;
  withPortfolio: number;
  topSkills: { skill: string; count: number }[];
  certifications: string[];
  candidates: { id: string; name: string; email: string | null; phone: string | null; experience: number; status: string; hasPortfolio: boolean; createdAt: string }[];
}

export default function ProfessionsPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<{ professions: ProfessionData[]; totalCandidates: number; totalProfessions: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [detailTab, setDetailTab] = useState<"list" | "skills" | "status">("list");

  useEffect(() => {
    fetch("/api/professions/analysis")
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleClassify = async () => {
    setClassifying(true);
    toast.info(t("professions.classify_now") + "...");
    try {
      const res = await fetch("/api/maintenance/classify-professions", { method: "POST" });
      const result = await res.json();
      toast.success(`${result.classified || 0} classified`);
      const refreshed = await fetch("/api/professions/analysis").then(r => r.json());
      setData(refreshed);
    } catch { toast.error(t("common.error")); }
    finally { setClassifying(false); }
  };

  const getProfName = (key: string) => {
    if (key === "unclassified") return t("professions.unclassified");
    return t(`job_categories.${key}`) || key.replace(/_/g, " ");
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ background: "var(--bg-primary)" }}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl p-5 animate-pulse" style={{ background: "var(--bg-card)", height: 160 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.totalCandidates === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center">
          <Users className="h-16 w-16 mx-auto mb-4" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{t("professions.no_candidates")}</p>
          <Link href="/candidates"><Button className="mt-4 rounded-lg" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}>{t("candidates.upload_cv")}</Button></Link>
        </div>
      </div>
    );
  }

  const professions = data.professions.filter(p => p.key !== "unclassified");
  const unclassified = data.professions.find(p => p.key === "unclassified");
  const mostCommon = professions[0];
  const selectedProf = selected ? data.professions.find(p => p.key === selected) : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="border-b px-8 py-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{t("professions.title")}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>{data.totalCandidates} {t("professions.total_classified")}</p>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{t("professions.total_professions")}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{data.totalProfessions}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{t("professions.total_classified")}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{data.totalCandidates - (unclassified?.count || 0)}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{t("professions.unclassified")}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: unclassified && unclassified.count > 0 ? "var(--status-rejected-text)" : "var(--text-primary)" }}>{unclassified?.count || 0}</p>
            {unclassified && unclassified.count > 0 && (
              <Button size="sm" className="mt-2 rounded-lg text-xs" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }} disabled={classifying} onClick={handleClassify}>
                {classifying ? <Loader2 className="h-3 w-3 animate-spin" /> : null} {t("professions.classify_now")}
              </Button>
            )}
          </div>
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{t("professions.most_common")}</p>
            <p className="text-lg font-bold mt-1" style={{ color: "var(--text-gold)" }}>{mostCommon ? getProfName(mostCommon.key) : "—"}</p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{mostCommon?.count || 0} {t("professions.candidates_in")}</p>
          </div>
        </div>

        {/* Profession Grid */}
        <div>
          <p className="text-sm mb-3" style={{ color: "var(--text-tertiary)" }}>{t("professions.select_to_see")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {professions.map(prof => (
              <button
                key={prof.key}
                onClick={() => { setSelected(selected === prof.key ? null : prof.key); setDetailTab("list"); }}
                className="text-right rounded-xl p-5 transition-all hover:shadow-md cursor-pointer"
                style={{
                  background: "var(--bg-card)",
                  border: selected === prof.key ? "2px solid var(--brand-gold)" : "0.5px solid var(--border-primary)",
                  borderLeft: `3px solid ${selected === prof.key ? "var(--brand-gold)" : "var(--border-secondary)"}`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold" style={{ color: "var(--text-primary)" }}>{getProfName(prof.key)}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-gold)" }}>{prof.count}</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {translateExperience(prof.avgExperience, locale)} {t("professions.years_avg")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {prof.withPortfolio > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-gold)" }}>
                        <FolderOpen className="h-3 w-3" /> {prof.withPortfolio}
                      </span>
                    )}
                  </div>
                </div>
                {/* Top skills */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {prof.topSkills.slice(0, 3).map(s => (
                    <span key={s.skill} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                      {translateSkill(s.skill, locale)}
                    </span>
                  ))}
                </div>
                {/* Status mini-bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden mt-3" style={{ background: "var(--bg-tertiary)" }}>
                  {Object.entries(prof.statusBreakdown).map(([status, count]) => {
                    const colors: Record<string, string> = { new: "var(--status-new-text)", reviewed: "var(--status-reviewed-text)", shortlisted: "var(--status-shortlisted-text)", approved: "var(--status-approved-text)", rejected: "var(--status-rejected-text)" };
                    return <div key={status} style={{ width: `${(count as number / prof.count) * 100}%`, background: colors[status] || "var(--text-tertiary)", opacity: 0.7 }} />;
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Profession Detail */}
        {selectedProf && (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-primary)", boxShadow: "var(--shadow-md)" }}>
            <div className="p-5 border-b" style={{ borderColor: "var(--border-primary)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{getProfName(selectedProf.key)}</h2>
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                    {selectedProf.count} {t("professions.candidates_in")} • {t("professions.avg_experience")}: {selectedProf.avgExperience} {t("professions.years_avg")} • {selectedProf.withPortfolio} {t("professions.with_portfolio")}
                  </p>
                </div>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 mt-4">
                {(["list", "skills", "status"] as const).map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ background: detailTab === tab ? "var(--brand-gold)" : "transparent", color: detailTab === tab ? "#1A1A1A" : "var(--text-secondary)" }}>
                    {tab === "list" ? t("professions.candidates_list") : tab === "skills" ? t("professions.skills_analysis") : t("professions.status_breakdown")}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {/* Candidates List */}
              {detailTab === "list" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      {[locale === "he" ? "שם" : "Name", locale === "he" ? "ניסיון" : "Exp", locale === "he" ? "סטטוס" : "Status", locale === "he" ? "תיק עבודות" : "Portfolio", locale === "he" ? "אימייל" : "Email"].map(h => (
                        <th key={h} className="text-right px-3 py-2 text-xs uppercase" style={{ color: "var(--text-tertiary)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProf.candidates.map(c => (
                      <tr key={c.id} style={{ borderBottom: "0.5px solid var(--border-light)" }}>
                        <td className="px-3 py-2.5">
                          <Link href={`/candidates/${c.id}`} className="font-medium hover:underline" style={{ color: "var(--text-primary)" }}>{c.name}</Link>
                        </td>
                        <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>{translateExperience(c.experience, locale)}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                        <td className="px-3 py-2.5">{c.hasPortfolio ? <FolderOpen className="h-4 w-4" style={{ color: "var(--brand-gold)" }} /> : "—"}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-tertiary)" }}>{c.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Skills Analysis */}
              {detailTab === "skills" && (
                <ResponsiveContainer width="100%" height={Math.max(200, selectedProf.topSkills.length * 32)}>
                  <BarChart data={selectedProf.topSkills.map(s => ({ name: translateSkill(s.skill, locale), count: s.count }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid {...GRID_STYLE} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} {...AXIS_STYLE} />
                    <YAxis type="category" dataKey="name" width={150} {...AXIS_STYLE} tick={{ ...AXIS_STYLE.tick, fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="count" fill="var(--brand-gold)" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* Status Breakdown */}
              {detailTab === "status" && (
                <div className="space-y-3">
                  {Object.entries(selectedProf.statusBreakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-3">
                      <StatusBadge status={status} />
                      <div className="flex-1 h-2 rounded-full" style={{ background: "var(--bg-tertiary)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${((count as number) / selectedProf.count) * 100}%`, background: "var(--brand-gold)" }} />
                      </div>
                      <span className="text-sm font-bold w-8 text-left" style={{ color: "var(--text-primary)" }}>{count as number}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unclassified warning */}
        {unclassified && unclassified.count > 0 && (
          <div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--status-shortlisted-text)", borderLeft: "4px solid var(--status-shortlisted-text)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" style={{ color: "var(--status-shortlisted-text)" }} />
                <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>{t("professions.unclassified_warning")}</h3>
                <span className="text-sm font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--status-shortlisted-bg)", color: "var(--status-shortlisted-text)" }}>{unclassified.count}</span>
              </div>
              <Button size="sm" className="rounded-lg text-xs" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }} disabled={classifying} onClick={handleClassify}>
                {classifying ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Award className="h-3 w-3 ml-1" />}
                {t("professions.auto_classify_all")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {unclassified.candidates.slice(0, 10).map(c => (
                <Link key={c.id} href={`/candidates/${c.id}`} className="text-xs px-2.5 py-1 rounded-lg hover:opacity-80" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                  {c.name}
                </Link>
              ))}
              {unclassified.count > 10 && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>+{unclassified.count - 10}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
