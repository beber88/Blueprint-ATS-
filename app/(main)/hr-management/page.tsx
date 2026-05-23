"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { getScoreColor } from "@/lib/chart-config";
import {
  Brain, Users, ClipboardCheck, Calendar, DollarSign, Star, GraduationCap,
  UserPlus, UserMinus, Package, Network, Clock, Loader2, ChevronRight, ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { BrainInsight, BrainScore } from "@/types/ai-brain";

const HR_MODULES = [
  { key: "employees", path: "/hr-management/employees", icon: Users },
  { key: "attendance", path: "/hr-management/attendance", icon: ClipboardCheck },
  { key: "leave", path: "/hr-management/leave", icon: Calendar },
  { key: "salary", path: "/hr-management/salary", icon: DollarSign },
  { key: "shifts", path: "/hr-management/shifts", icon: Clock },
  { key: "reviews", path: "/hr-management/reviews", icon: Star },
  { key: "training", path: "/hr-management/training", icon: GraduationCap },
  { key: "onboarding", path: "/hr-management/onboarding", icon: UserPlus },
  { key: "offboarding", path: "/hr-management/offboarding", icon: UserMinus },
  { key: "assets", path: "/hr-management/assets", icon: Package },
  { key: "org_chart", path: "/hr-management/org-chart", icon: Network },
  { key: "qc", path: "/hr-management/qc", icon: ShieldCheck },
];

export default function HRManagementLanding() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [companyScore, setCompanyScore] = useState<BrainScore | null>(null);
  const [topInsights, setTopInsights] = useState<BrainInsight[]>([]);
  const [stats, setStats] = useState({ employees: 0, pendingLeave: 0, overdueReviews: 0, todayPresent: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/ai-brain/scores?scope=company").then(r => r.json()),
      fetch("/api/ai-brain/insights?status=active&limit=3").then(r => r.json()),
      fetch("/api/operations/employees").then(r => r.json()).catch(() => ({ employees: [] })),
      fetch("/api/hr/leave?status=pending").then(r => r.json()).catch(() => ({ requests: [] })),
      fetch(`/api/hr/attendance?date=${new Date().toISOString().slice(0, 10)}`).then(r => r.json()).catch(() => ({ attendance: [] })),
    ]).then(([scoresData, insightsData, empsData, leaveData, attData]) => {
      const scores = scoresData.scores || [];
      setCompanyScore(scores.find((s: BrainScore) => s.scope === "company") || null);
      setTopInsights(insightsData.insights || []);
      const emps = empsData.employees || [];
      const att = attData.attendance || [];
      setStats({
        employees: emps.length,
        pendingLeave: (leaveData.requests || []).length,
        overdueReviews: 0,
        todayPresent: att.filter((a: { status: string }) => a.status === "present" || a.status === "late").length,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <OpsPageShell title={t("hr_mgmt.ai_brain.landing.title")} subtitle={t("hr_mgmt.ai_brain.landing.subtitle")}>
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      </OpsPageShell>
    );
  }

  return (
    <OpsPageShell title={t("hr_mgmt.ai_brain.landing.title")} subtitle={t("hr_mgmt.ai_brain.landing.subtitle")}>
      {/* AI Brain Score + Quick Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, marginBottom: 20 }}>
        {/* Mini Health Score */}
        <Link href="/hr-management/ai-brain" style={{ textDecoration: "none" }}>
          <OpsCard style={{ textAlign: "center", padding: 20, cursor: "pointer", minWidth: 160 }}>
            <Brain size={20} style={{ color: "#C9A84C", marginBottom: 6 }} />
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 8px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `conic-gradient(${getScoreColor(companyScore?.score || 0)} ${(companyScore?.score || 0) * 3.6}deg, var(--border-light) 0deg)`,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: "var(--bg-card)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: getScoreColor(companyScore?.score || 0) }}>
                  {companyScore?.score || "—"}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t("hr_mgmt.ai_brain.health_score")}</div>
          </OpsCard>
        </Link>

        {/* Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <KpiCard label={t("hr_mgmt.ai_brain.landing.total_employees")} value={stats.employees} accent="#C9A84C" />
          <KpiCard label={t("hr_mgmt.ai_brain.landing.pending_leave")} value={stats.pendingLeave} accent="#8A6D1B" />
          <KpiCard label={t("hr_mgmt.ai_brain.landing.today_attendance")} value={stats.todayPresent} accent="#2D7A3E" />
          <KpiCard label={t("hr_mgmt.ai_brain.kpi.active_insights")} value={topInsights.length} accent="#5B3F9E" />
        </div>
      </div>

      {/* Top Insights */}
      {topInsights.length > 0 && (
        <OpsCard title={t("hr_mgmt.ai_brain.landing.top_insights")} style={{ marginBottom: 20 }}>
          {topInsights.map(ins => (
            <div key={ins.id} style={{
              padding: "10px 0", borderBottom: "1px solid var(--border-light)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", fontWeight: 600,
                background: ins.severity === "critical" ? "rgba(163,45,45,0.1)" : ins.severity === "warning" ? "rgba(201,168,76,0.15)" : "rgba(26,86,168,0.1)",
                color: ins.severity === "critical" ? "#A32D2D" : ins.severity === "warning" ? "#C9A84C" : "#1A56A8",
              }}>
                {t(`hr_mgmt.ai_brain.severity.${ins.severity}`)}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{ins.title}</span>
            </div>
          ))}
          <Link href="/hr-management/ai-brain" style={{
            display: "flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 12,
            color: "#C9A84C", textDecoration: "none",
          }}>
            {t("hr_mgmt.ai_brain.title")} <ChevronRight size={14} />
          </Link>
        </OpsCard>
      )}

      {/* HR Modules Grid */}
      <OpsCard title={t("hr_mgmt.ai_brain.landing.modules")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {HR_MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <Link key={mod.key} href={mod.path} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: 16, borderRadius: 8, border: "1px solid var(--border-light)",
                textDecoration: "none", color: "var(--text-primary)",
                background: "var(--bg-secondary)", transition: "background 0.15s",
              }}>
                <Icon size={20} style={{ color: "#C9A84C" }} />
                <span style={{ fontSize: 12, fontWeight: 500, textAlign: "center" }}>{t(`hr_mgmt.nav.${mod.key}`)}</span>
              </Link>
            );
          })}
        </div>
      </OpsCard>
    </OpsPageShell>
  );
}
