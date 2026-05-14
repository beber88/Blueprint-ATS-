"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Plus, BookOpen, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Course {
  id: string;
  name: string;
  description?: string | null;
  duration_hours?: number | null;
  mandatory: boolean;
  category?: string | null;
  status?: string;
  created_at?: string;
}

interface Enrollment {
  id: string;
  employee_id: string;
  employee_name?: string;
  course_id: string;
  course_name?: string;
  status: string;
  enrolled_at: string;
  completed_at?: string | null;
  score?: number | null;
}

type Section = "courses" | "enrollments";

const ENROLL_STATUS_COLORS: Record<string, string> = {
  enrolled: "#3B82F6",
  in_progress: "#F59E0B",
  completed: "#10B981",
  dropped: "#EF4444",
};

export default function TrainingPage() {
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("courses");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", duration_hours: 1, mandatory: false });

  const load = async () => {
    setLoading(true);
    const [cr, er] = await Promise.all([
      fetch("/api/hr/training/courses").then((r) => r.json()),
      fetch("/api/hr/training/enrollments").then((r) => r.json()),
    ]);
    setCourses(cr.courses || []);
    setEnrollments(er.enrollments || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCourse = async () => {
    if (!form.name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/hr/training/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      setShowForm(false);
      setForm({ name: "", description: "", duration_hours: 1, mandatory: false });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const completedCount = enrollments.filter((e) => e.status === "completed").length;
  const inProgressCount = enrollments.filter((e) => e.status === "in_progress").length;

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13,
  };

  return (
    <OpsPageShell
      title={t("hr_mgmt.training.title")}
      subtitle={t("hr_mgmt.training.subtitle")}
      actions={
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: "#C9A84C", color: "#1A1A1A",
            border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >
          <Plus size={14} />
          {t("hr_mgmt.training.new_course")}
        </button>
      }
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label={t("hr_mgmt.training.courses")} value={courses.length} accent="#C9A84C" />
        <KpiCard label={t("hr_mgmt.training.enrollments")} value={enrollments.length} accent="#3B82F6" />
        <KpiCard label={t("hr_mgmt.training.completed")} value={completedCount} accent="#10B981" />
        <KpiCard label={t("hr_mgmt.training.in_progress")} value={inProgressCount} accent="#F59E0B" />
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["courses", "enrollments"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: "none", cursor: "pointer",
              background: section === s ? "rgba(201,168,76,0.15)" : "var(--bg-card)",
              color: section === s ? "#C9A84C" : "var(--text-secondary)",
              borderWidth: 1, borderStyle: "solid",
              borderColor: section === s ? "rgba(201,168,76,0.35)" : "var(--border-light)",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {s === "courses" ? <BookOpen size={12} /> : <Users size={12} />}
            {t(`hr_mgmt.training.${s}`)}
          </button>
        ))}
      </div>

      {/* New course form */}
      {showForm && (
        <OpsCard style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <input
              placeholder="Course Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={inputStyle}
            />
            <input
              type="number"
              placeholder="Duration (hours)"
              value={form.duration_hours}
              onChange={(e) => setForm({ ...form, duration_hours: Number(e.target.value) })}
              style={inputStyle}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.mandatory}
                onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
              />
              {t("hr_mgmt.training.mandatory")}
            </label>
            <button
              onClick={createCourse}
              disabled={busy}
              style={{
                padding: "8px 16px", borderRadius: 6, border: "none",
                background: "#C9A84C", color: "#1A1A1A", cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
            </button>
          </div>
        </OpsCard>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : section === "courses" ? (
        courses.length === 0 ? (
          <OpsCard>
            <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              {t("hr_mgmt.training.no_courses")}
            </p>
          </OpsCard>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            {courses.map((course) => {
              const enrolled = enrollments.filter((e) => e.course_id === course.id);
              const completed = enrolled.filter((e) => e.status === "completed").length;
              return (
                <OpsCard key={course.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{course.name}</div>
                    {course.mandatory && (
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#EF444420", color: "#EF4444" }}>
                        {t("hr_mgmt.training.mandatory")}
                      </span>
                    )}
                  </div>
                  {course.description && (
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 8px 0" }}>{course.description}</p>
                  )}
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)" }}>
                    {course.duration_hours && <span>{course.duration_hours}h</span>}
                    <span>{enrolled.length} enrolled</span>
                    <span>{completed} completed</span>
                  </div>
                </OpsCard>
              );
            })}
          </div>
        )
      ) : (
        enrollments.length === 0 ? (
          <OpsCard>
            <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              No enrollments yet
            </p>
          </OpsCard>
        ) : (
          <OpsCard>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Employee</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Course</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Enrolled</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Completed</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enr) => {
                  const course = courses.find((c) => c.id === enr.course_id);
                  return (
                    <tr key={enr.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>
                        {enr.employee_name || enr.employee_id}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                        {enr.course_name || course?.name || "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                          background: `${ENROLL_STATUS_COLORS[enr.status] || "#6B7280"}20`,
                          color: ENROLL_STATUS_COLORS[enr.status] || "#6B7280",
                        }}>
                          {enr.status.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                        {format(new Date(enr.enrolled_at), "MMM d, yyyy")}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                        {enr.completed_at ? format(new Date(enr.completed_at), "MMM d, yyyy") : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 500, color: "var(--text-primary)" }}>
                        {enr.score != null ? `${enr.score}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </OpsCard>
        )
      )}
    </OpsPageShell>
  );
}
