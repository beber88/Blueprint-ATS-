"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { getScoreColor, getChartColors, TOOLTIP_STYLE, AXIS_STYLE, GRID_STYLE } from "@/lib/chart-config";
import { useTheme } from "@/lib/theme/context";
import {
  Brain, RefreshCw, Loader2, AlertTriangle, TrendingDown, Lightbulb,
  DollarSign, Target, ShieldAlert, GraduationCap, UserX,
  ChevronRight, Send, Bot, User, X,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import Link from "next/link";
import type { BrainInsight, BrainScore, ComputedMetrics, InsightType } from "@/types/ai-brain";

const INSIGHT_ICONS: Record<InsightType, typeof DollarSign> = {
  cost_saving: DollarSign,
  performance_alert: TrendingDown,
  efficiency_tip: Lightbulb,
  strategic: Target,
  risk_alert: ShieldAlert,
  attendance_pattern: AlertTriangle,
  training_gap: GraduationCap,
  turnover_risk: UserX,
};

const INSIGHT_COLORS: Record<InsightType, string> = {
  cost_saving: "#2D7A3E",
  performance_alert: "#A32D2D",
  efficiency_tip: "#C9A84C",
  strategic: "#5B3F9E",
  risk_alert: "#A32D2D",
  attendance_pattern: "#1A56A8",
  training_gap: "#8A6D1B",
  turnover_risk: "#A32D2D",
};

const SEVERITY_COLORS: Record<string, string> = {
  info: "#1A56A8",
  warning: "#C9A84C",
  critical: "#A32D2D",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AIBrainPage() {
  const { t, locale } = useI18n();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = getChartColors(isDark);

  const [scores, setScores] = useState<BrainScore[]>([]);
  const [insights, setInsights] = useState<BrainInsight[]>([]);
  const [metrics, setMetrics] = useState<ComputedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [scoresRes, insightsRes, metricsRes] = await Promise.all([
        fetch("/api/ai-brain/scores"),
        fetch("/api/ai-brain/insights?status=active"),
        fetch("/api/ai-brain/scores", { method: "POST" }),
      ]);
      const [scoresData, insightsData, metricsData] = await Promise.all([
        scoresRes.json(),
        insightsRes.json(),
        metricsRes.json(),
      ]);
      setScores(scoresData.scores || []);
      setInsights(insightsData.insights || []);
      if (metricsData.metrics) setMetrics(metricsData.metrics);
      const companyScore = (scoresData.scores || []).find((s: BrainScore) => s.scope === "company");
      if (companyScore) setLastUpdated(companyScore.computed_at);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = async () => {
    setAnalyzing(true);
    try {
      await fetch("/api/ai-brain/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      await fetchData();
    } catch { /* silent */ }
    setAnalyzing(false);
  };

  const handleInsightAction = async (id: string, status: string) => {
    await fetch("/api/ai-brain/insights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  const sendChatMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/ai-brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, conversationHistory: chatMessages.slice(-8), locale }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.response || "Error" }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Error" }]);
    }
    setChatLoading(false);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { if (chatOpen) chatInputRef.current?.focus(); }, [chatOpen]);

  const companyScore = scores.find(s => s.scope === "company");
  const deptScores = scores.filter(s => s.scope === "department");
  const criticalCount = insights.filter(i => i.severity === "critical").length;

  if (loading) {
    return (
      <OpsPageShell title={t("hr_mgmt.ai_brain.title")} subtitle={t("hr_mgmt.ai_brain.subtitle")}>
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      </OpsPageShell>
    );
  }

  return (
    <OpsPageShell
      title={t("hr_mgmt.ai_brain.title")}
      subtitle={t("hr_mgmt.ai_brain.subtitle")}
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {t("hr_mgmt.ai_brain.last_updated")}: {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={analyzing}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              borderRadius: 8, border: "none", cursor: analyzing ? "wait" : "pointer",
              background: "linear-gradient(135deg, #C9A84C, #8B5CF6)",
              color: "#fff", fontSize: 13, fontWeight: 600,
            }}
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {analyzing ? t("hr_mgmt.ai_brain.actions.refreshing") : t("hr_mgmt.ai_brain.actions.refresh")}
          </button>
        </div>
      }
    >
      {/* ── Health Score Hero ──────────────────────────────────────────── */}
      <OpsCard style={{ marginBottom: 20, textAlign: "center", padding: 28 }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)", marginBottom: 8 }}>
          {t("hr_mgmt.ai_brain.health_score")}
        </div>
        <div style={{
          width: 120, height: 120, borderRadius: "50%", margin: "0 auto 16px",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `conic-gradient(${getScoreColor(companyScore?.score || 0)} ${(companyScore?.score || 0) * 3.6}deg, var(--border-light) 0deg)`,
        }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: getScoreColor(companyScore?.score || 0) }}>
              {companyScore?.score || 0}
            </span>
          </div>
        </div>
        {companyScore?.breakdown && (
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            {(Object.entries(companyScore.breakdown) as [string, number][]).map(([key, val]) => (
              <div key={key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: getScoreColor(val) }}>{val}%</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                  {t(`hr_mgmt.ai_brain.breakdown.${key}`)}
                </div>
              </div>
            ))}
          </div>
        )}
      </OpsCard>

      {/* ── KPI Strip ─────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label={t("hr_mgmt.ai_brain.kpi.active_insights")} value={insights.length} accent="#C9A84C" />
        <KpiCard label={t("hr_mgmt.ai_brain.kpi.critical_alerts")} value={criticalCount} accent="#A32D2D" />
        <KpiCard label={t("hr_mgmt.ai_brain.kpi.at_risk")} value={metrics?.at_risk_count || 0} accent="#A32D2D" />
        <KpiCard label={t("hr_mgmt.ai_brain.kpi.training_compliance")} value={`${metrics?.training_compliance || 0}%`} accent="#2D7A3E" />
        <KpiCard label={t("hr_mgmt.ai_brain.kpi.attendance_rate")} value={`${metrics?.attendance_rate || 0}%`} accent="#1A56A8" />
      </div>

      {/* ── Insight Cards ─────────────────────────────────────────────── */}
      <OpsCard title={t("hr_mgmt.ai_brain.kpi.active_insights")} style={{ marginBottom: 20 }}>
        {insights.length === 0 ? (
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: 13 }}>
            {t("hr_mgmt.ai_brain.no_insights")}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {insights.map(ins => {
              const Icon = INSIGHT_ICONS[ins.type] || Lightbulb;
              const typeColor = INSIGHT_COLORS[ins.type] || "#C9A84C";
              const sevColor = SEVERITY_COLORS[ins.severity] || "#1A56A8";
              return (
                <div key={ins.id} style={{
                  border: "1px solid var(--border-light)", borderRadius: 8, padding: 14,
                  borderInlineStart: `4px solid ${typeColor}`,
                  background: "var(--bg-secondary)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Icon size={16} style={{ color: typeColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
                      {ins.title}
                    </span>
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 4,
                      background: `${sevColor}18`, color: sevColor, fontWeight: 600, textTransform: "uppercase",
                    }}>
                      {t(`hr_mgmt.ai_brain.severity.${ins.severity}`)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.5 }}>
                    {ins.description}
                  </p>
                  {ins.recommendation && (
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "0 0 10px", fontStyle: "italic" }}>
                      {ins.recommendation}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleInsightAction(ins.id, "acknowledged")}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer" }}>
                      {t("hr_mgmt.ai_brain.actions.acknowledge")}
                    </button>
                    <button onClick={() => handleInsightAction(ins.id, "resolved")}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "none", background: "#2D7A3E", color: "#fff", cursor: "pointer" }}>
                      {t("hr_mgmt.ai_brain.actions.resolve")}
                    </button>
                    <button onClick={() => handleInsightAction(ins.id, "dismissed")}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}>
                      {t("hr_mgmt.ai_brain.actions.dismiss")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </OpsCard>

      {/* ── Charts Row: Dept Comparison + Trends ──────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Department Comparison */}
        <OpsCard title={t("hr_mgmt.ai_brain.dept_comparison")}>
          {deptScores.length === 0 ? (
            <p style={{ textAlign: "center", padding: 30, color: "var(--text-secondary)", fontSize: 12 }}>No department data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, deptScores.length * 40)}>
              <BarChart layout="vertical" data={deptScores.map(s => ({ name: s.scope_name || s.scope_id?.slice(0, 8), score: s.score }))} margin={{ left: 10, right: 20 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis type="number" domain={[0, 100]} {...AXIS_STYLE} />
                <YAxis type="category" dataKey="name" width={100} {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {deptScores.map((s, i) => (
                    <Cell key={i} fill={getScoreColor(s.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </OpsCard>

        {/* Attendance Trend */}
        <OpsCard title={t("hr_mgmt.ai_brain.trends.attendance")}>
          {!metrics?.trends.attendance_30d?.length ? (
            <p style={{ textAlign: "center", padding: 30, color: "var(--text-secondary)", fontSize: 12 }}>No trend data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metrics.trends.attendance_30d} margin={{ left: 0, right: 10 }}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="date" {...AXIS_STYLE} tickFormatter={d => d.slice(5)} />
                <YAxis domain={[60, 100]} {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="rate" stroke={colors[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </OpsCard>
      </div>

      {/* ── Employee Risk Radar ───────────────────────────────────────── */}
      <OpsCard title={t("hr_mgmt.ai_brain.risk_radar.title")} style={{ marginBottom: 20 }}>
        {!metrics?.employee_risks?.length ? (
          <p style={{ textAlign: "center", padding: 30, color: "var(--text-secondary)", fontSize: 13 }}>
            {t("hr_mgmt.ai_brain.risk_radar.no_risks")}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.ai_brain.risk_radar.col_name")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.ai_brain.risk_radar.col_department")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.ai_brain.risk_radar.col_factors")}</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.ai_brain.risk_radar.col_score")}</th>
                <th style={{ padding: "8px 12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {metrics.employee_risks.slice(0, 20).map(er => (
                <tr key={er.employee_id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>{er.full_name}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{er.department_name}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {er.risk_factors.map(f => (
                        <span key={f} style={{
                          fontSize: 10, padding: "2px 6px", borderRadius: 4,
                          background: "rgba(163,45,45,0.1)", color: "#A32D2D", fontWeight: 500,
                        }}>
                          {t(`hr_mgmt.ai_brain.risk_factors.${f}`)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontWeight: 600, color: getScoreColor(100 - er.risk_score) }}>{er.risk_score}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Link href={`/hr-management/employees/${er.employee_id}`}
                      style={{ color: "#C9A84C", display: "flex", alignItems: "center", gap: 2, textDecoration: "none", fontSize: 12 }}>
                      {t("hr_mgmt.ai_brain.actions.view_employee")} <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </OpsCard>

      {/* ── Inline AI Chat ────────────────────────────────────────────── */}
      <OpsCard style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Brain size={18} style={{ color: "#C9A84C" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{t("hr_mgmt.ai_brain.chat.title")}</span>
          </div>
          {chatMessages.length > 0 && (
            <button onClick={() => { setChatMessages([]); setChatOpen(false); }}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>
              <X size={16} />
            </button>
          )}
        </div>

        {!chatOpen && chatMessages.length === 0 ? (
          <button onClick={() => setChatOpen(true)}
            style={{
              width: "100%", padding: 16, border: "1px dashed var(--border-light)", borderRadius: 8,
              background: "var(--bg-secondary)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            <Bot size={16} />
            {t("hr_mgmt.ai_brain.chat.empty")}
          </button>
        ) : (
          <>
            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 10, padding: 8, background: "var(--bg-secondary)", borderRadius: 8 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: msg.role === "user" ? "#C9A84C" : "linear-gradient(135deg, #C9A84C, #8B5CF6)",
                  }}>
                    {msg.role === "user" ? <User size={12} color="#fff" /> : <Bot size={12} color="#fff" />}
                  </div>
                  <div style={{
                    maxWidth: "80%", padding: "8px 12px", borderRadius: 10, fontSize: 12, lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    background: msg.role === "user" ? "#C9A84C" : "var(--bg-card)",
                    color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: "#C9A84C" }} />
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t("hr_mgmt.ai_brain.chat.thinking")}</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendChatMessage(); }}
                placeholder={t("hr_mgmt.ai_brain.chat.placeholder")}
                disabled={chatLoading}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 12,
                  border: "1px solid var(--border-light)", background: "var(--bg-secondary)", color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
                style={{
                  width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: chatInput.trim() ? "#C9A84C" : "var(--border-light)",
                }}>
                <Send size={14} color="#fff" />
              </button>
            </div>
          </>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
