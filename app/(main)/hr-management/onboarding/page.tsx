"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
}

interface OnboardingChecklist {
  id: string;
  employee_id: string;
  employee_name?: string;
  process_type: string;
  status: string;
  start_date: string;
  target_date?: string | null;
  tasks: Task[];
}

export default function OnboardingPage() {
  const { t } = useI18n();
  const [checklists, setChecklists] = useState<OnboardingChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/hr/onboarding?type=onboarding");
    const data = await res.json();
    setChecklists(data.checklists || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleTask = async (checklistId: string, taskId: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/hr/onboarding/${checklistId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error(await res.text());
      setChecklists((prev) =>
        prev.map((cl) =>
          cl.id === checklistId
            ? { ...cl, tasks: cl.tasks.map((tk) => (tk.id === taskId ? { ...tk, completed } : tk)) }
            : cl
        )
      );
    } catch {
      toast.error(t("common.error"));
    }
  };

  const activeCount = checklists.filter((c) => c.status === "in_progress").length;
  const completedCount = checklists.filter((c) => c.status === "completed").length;

  return (
    <OpsPageShell
      title={t("hr_mgmt.onboarding.title")}
      subtitle={t("hr_mgmt.onboarding.subtitle")}
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label="Active" value={activeCount} accent="#F59E0B" />
        <KpiCard label={t("hr_mgmt.onboarding.completed")} value={completedCount} accent="#10B981" />
        <KpiCard label="Total" value={checklists.length} accent="#C9A84C" />
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : checklists.length === 0 ? (
        <OpsCard>
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            {t("hr_mgmt.onboarding.no_active")}
          </p>
        </OpsCard>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
          {checklists.map((cl) => {
            const total = cl.tasks.length;
            const done = cl.tasks.filter((tk) => tk.completed).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <OpsCard key={cl.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {cl.employee_name || cl.employee_id}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      Started {format(new Date(cl.start_date), "MMM d, yyyy")}
                      {cl.target_date && ` · Due ${format(new Date(cl.target_date), "MMM d, yyyy")}`}
                    </div>
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                    background: cl.status === "completed" ? "#10B98120" : "#F59E0B20",
                    color: cl.status === "completed" ? "#10B981" : "#F59E0B",
                  }}>
                    {cl.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                    <span>{t("hr_mgmt.onboarding.progress")}</span>
                    <span>{done}/{total} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--border-light)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: pct === 100 ? "#10B981" : "#C9A84C", transition: "width 0.3s" }} />
                  </div>
                </div>

                {/* Tasks */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {cl.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(cl.id, task.id, !task.completed)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                        background: task.completed ? "rgba(16,185,129,0.06)" : "transparent",
                      }}
                    >
                      {task.completed ? (
                        <CheckCircle2 size={16} color="#10B981" />
                      ) : (
                        <Circle size={16} color="var(--text-secondary)" />
                      )}
                      <span style={{
                        fontSize: 13, color: task.completed ? "var(--text-secondary)" : "var(--text-primary)",
                        textDecoration: task.completed ? "line-through" : "none",
                        flex: 1,
                      }}>
                        {task.title}
                      </span>
                      {task.due_date && (
                        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                          {format(new Date(task.due_date), "MMM d")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </OpsCard>
            );
          })}
        </div>
      )}
    </OpsPageShell>
  );
}
