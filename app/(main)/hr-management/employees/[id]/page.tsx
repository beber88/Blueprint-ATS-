"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Tab = "details" | "documents" | "salary" | "attendance" | "leave" | "reviews" | "training" | "assets" | "history";

interface Department {
  id: string;
  name: string;
  name_he: string | null;
  color: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  department_id?: string | null;
  department?: Department | null;
  hire_date?: string | null;
  employment_type?: string | null;
  manager_id?: string | null;
  is_active?: boolean;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  national_id?: string | null;
  salary_grade?: string | null;
  government_ids?: Record<string, string> | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  tin_number?: string | null;
  emergency_contact?: { name?: string; phone?: string; relation?: string } | null;
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploaded_at: string;
  url?: string;
}

interface HistoryEntry {
  id: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  notes?: string | null;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  reason?: string | null;
}

interface Asset {
  id: string;
  asset_name: string;
  asset_type: string;
  serial_number?: string | null;
  assigned_at: string;
  returned_at?: string | null;
}

interface SalaryRecord {
  id: string;
  effective_date: string;
  base_salary: number;
  currency: string;
  pay_frequency: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  status: string;
}

interface ReviewRecord {
  id: string;
  review_date: string;
  review_period: string | null;
  rating: number | null;
  status: string;
}

interface TrainingRecord {
  id: string;
  course_title: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  score: number | null;
}

const TABS: { key: Tab; labelKey: string }[] = [
  { key: "details", labelKey: "hr_mgmt.employees.tab_details" },
  { key: "documents", labelKey: "hr_mgmt.employees.tab_documents" },
  { key: "salary", labelKey: "hr_mgmt.employees.tab_salary" },
  { key: "attendance", labelKey: "hr_mgmt.employees.tab_attendance" },
  { key: "leave", labelKey: "hr_mgmt.employees.tab_leave" },
  { key: "reviews", labelKey: "hr_mgmt.employees.tab_reviews" },
  { key: "training", labelKey: "hr_mgmt.employees.tab_training" },
  { key: "assets", labelKey: "hr_mgmt.employees.tab_assets" },
  { key: "history", labelKey: "hr_mgmt.employees.tab_history" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
  cancelled: "#6B7280",
};

export default function EmployeeDetailPage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const id = params.id as string;
  const [tab, setTab] = useState<Tab>("details");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [salary, setSalary] = useState<SalaryRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [training, setTraining] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  const isHe = locale === "he";
  const dateFmt = isHe ? "he-IL" : "en-US";

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString(dateFmt, { day: "numeric", month: "short", year: "numeric" });
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/hr/employees/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setEmployee(d.employee || null);
        // Pre-populate tab data from the single API response
        if (d.documents) setDocuments(d.documents);
        if (d.salary_records) setSalary(d.salary_records);
        if (d.leave_requests) setLeaves(d.leave_requests);
        if (d.performance_reviews) setReviews(d.performance_reviews);
        if (d.assets) setAssets(d.assets);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setTabLoading(true);
    const controller = new AbortController();
    const signal = controller.signal;

    const loadTab = async () => {
      try {
        if (tab === "documents") {
          const res = await fetch(`/api/hr/employees/${id}/documents`, { signal });
          const data = await res.json();
          setDocuments(data.documents || []);
        } else if (tab === "salary") {
          const res = await fetch(`/api/hr/salary?employee_id=${id}`, { signal });
          const data = await res.json();
          setSalary(data.records || data.salaries || []);
        } else if (tab === "attendance") {
          const res = await fetch(`/api/hr/attendance?employee_id=${id}`, { signal });
          const data = await res.json();
          setAttendance(data.records || data.attendance || []);
        } else if (tab === "leave") {
          const res = await fetch(`/api/hr/leave?employee_id=${id}`, { signal });
          const data = await res.json();
          setLeaves(data.requests || []);
        } else if (tab === "reviews") {
          const res = await fetch(`/api/hr/reviews?employee_id=${id}`, { signal });
          const data = await res.json();
          setReviews(data.reviews || []);
        } else if (tab === "training") {
          const res = await fetch(`/api/hr/training/enrollments?employee_id=${id}`, { signal });
          const data = await res.json();
          setTraining(data.enrollments || []);
        } else if (tab === "assets") {
          const res = await fetch(`/api/hr/assets/assignments?employee_id=${id}`, { signal });
          const data = await res.json();
          setAssets(data.assignments || []);
        } else if (tab === "history") {
          const res = await fetch(`/api/hr/employees/${id}/history`, { signal });
          const data = await res.json();
          setHistory(data.history || []);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("Failed to load tab data", e);
        }
      } finally {
        setTabLoading(false);
      }
    };

    if (tab !== "details") {
      loadTab();
    } else {
      setTabLoading(false);
    }

    return () => controller.abort();
  }, [id, tab]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("employee_id", id);
    try {
      const res = await fetch(`/api/hr/employees/${id}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      const data = await res.json();
      setDocuments((prev) => [...prev, data.document].filter(Boolean));
    } catch {
      toast.error(t("common.error"));
    }
  };

  if (loading) {
    return (
      <OpsPageShell title={t("hr_mgmt.employees.title")} backHref="/hr/hr-management/employees">
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      </OpsPageShell>
    );
  }

  if (!employee) {
    return (
      <OpsPageShell title={t("hr_mgmt.employees.title")} backHref="/hr/hr-management/employees">
        <OpsCard>
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            {t("common.not_found") || "Employee not found"}
          </p>
        </OpsCard>
      </OpsPageShell>
    );
  }

  const infoRow = (label: string, value: string | null | undefined) => (
    <div style={{ display: "flex", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
      <span style={{ width: 180, color: "var(--text-secondary)", fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontSize: 13 }}>{value || "—"}</span>
    </div>
  );

  // Get gov IDs from either flat columns or the JSONB field
  const govIds = employee.government_ids || {};
  const sss = employee.sss_number || govIds.sss || null;
  const philhealth = employee.philhealth_number || govIds.philhealth || null;
  const pagibig = employee.pagibig_number || govIds.pagibig || null;
  const tin = employee.tin_number || govIds.tin || null;

  // Get emergency contact from JSONB
  const ec = employee.emergency_contact;

  // Get department name localized
  const deptName = employee.department
    ? (isHe ? (employee.department.name_he || employee.department.name) : employee.department.name)
    : null;

  return (
    <OpsPageShell
      title={employee.full_name}
      subtitle={employee.role || undefined}
      backHref="/hr/hr-management/employees"
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border-light)", paddingBottom: 0, overflowX: "auto" }}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "none", background: "none", whiteSpace: "nowrap",
              color: tab === tb.key ? "#C9A84C" : "var(--text-secondary)",
              borderBottom: tab === tb.key ? "2px solid #C9A84C" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tabLoading && tab !== "details" ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : (
        <>
          {/* Details Tab */}
          {tab === "details" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
              <OpsCard title={t("hr_mgmt.employees.personal_info")}>
                {infoRow(t("hr_mgmt.employees.field.full_name"), employee.full_name)}
                {infoRow(t("hr_mgmt.employees.field.email"), employee.email)}
                {infoRow(t("hr_mgmt.employees.field.phone"), employee.phone)}
                {infoRow(t("hr_mgmt.employees.field.date_of_birth"), fmtDate(employee.date_of_birth))}
                {infoRow(t("hr_mgmt.employees.field.gender"), employee.gender)}
                {infoRow(t("hr_mgmt.employees.field.address"), employee.address)}
                {infoRow(t("hr_mgmt.employees.field.national_id"), employee.national_id)}
              </OpsCard>
              <OpsCard title={t("hr_mgmt.employees.employment_info")}>
                {infoRow(t("hr_mgmt.employees.field.position"), employee.role)}
                {infoRow(t("hr_mgmt.employees.field.department"), deptName)}
                {infoRow(t("hr_mgmt.employees.field.employment_type"), employee.employment_type)}
                {infoRow(t("hr_mgmt.employees.field.hire_date"), fmtDate(employee.hire_date))}
                {infoRow(t("hr_mgmt.employees.field.status"), employee.is_active ? t("hr_mgmt.employees.field.active") : t("hr_mgmt.employees.field.inactive"))}
              </OpsCard>
              <OpsCard title={t("hr_mgmt.employees.emergency_contact")}>
                {infoRow(t("hr_mgmt.employees.field.ec_name"), ec?.name || null)}
                {infoRow(t("hr_mgmt.employees.field.ec_phone"), ec?.phone || null)}
                {infoRow(t("hr_mgmt.employees.field.ec_relation"), ec?.relation || null)}
              </OpsCard>
              <OpsCard title={t("hr_mgmt.employees.field.gov_ids")}>
                {infoRow("SSS", sss)}
                {infoRow("PhilHealth", philhealth)}
                {infoRow("Pag-IBIG", pagibig)}
                {infoRow("TIN", tin)}
              </OpsCard>
            </div>
          )}

          {/* Documents Tab */}
          {tab === "documents" && (
            <OpsCard>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <label
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 8,
                    background: "#C9A84C", color: "#1A1A1A",
                    cursor: "pointer", fontSize: 13, fontWeight: 600,
                  }}
                >
                  <Upload size={14} />
                  {t("hr_mgmt.employees.upload_document")}
                  <input type="file" onChange={handleUpload} style={{ display: "none" }} />
                </label>
              </div>
              {documents.length === 0 ? (
                <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  {t("hr_mgmt.employees.no_documents")}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.doc_name")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.doc_type")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.doc_uploaded")}</th>
                      <th style={{ padding: "8px 12px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 500 }}>{doc.name}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{doc.type}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                          {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: "#C9A84C", fontSize: 12, textDecoration: "none" }}>
                              {t("common.view")}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </OpsCard>
          )}

          {/* History Tab */}
          {tab === "history" && (
            <OpsCard>
              {history.length === 0 ? (
                <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  {t("hr_mgmt.employees.no_history")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {history.map((entry) => (
                    <div key={entry.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border-light)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C9A84C", marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{entry.change_type}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          {entry.old_value && <span>{entry.old_value} &rarr; </span>}
                          {entry.new_value && <span style={{ fontWeight: 500 }}>{entry.new_value}</span>}
                        </div>
                        {entry.notes && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{entry.notes}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {format(new Date(entry.changed_at), "MMM d, yyyy")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </OpsCard>
          )}

          {/* Leave Tab */}
          {tab === "leave" && (
            <OpsCard>
              {leaves.length === 0 ? (
                <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  {t("hr_mgmt.leave.no_requests")}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.leave_type")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.dates")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.days")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.status")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.reason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((lv) => (
                      <tr key={lv.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 500 }}>{lv.leave_type}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                          {format(new Date(lv.start_date), "MMM d")} - {format(new Date(lv.end_date), "MMM d, yyyy")}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>{lv.days_count}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                            background: `${STATUS_COLORS[lv.status] || "#6B7280"}20`,
                            color: STATUS_COLORS[lv.status] || "#6B7280",
                          }}>
                            {lv.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lv.reason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </OpsCard>
          )}

          {/* Salary Tab */}
          {tab === "salary" && (
            <OpsCard>
              {salary.length === 0 ? (
                <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  {t("hr_mgmt.salary.no_records") !== "hr_mgmt.salary.no_records" ? t("hr_mgmt.salary.no_records") : "No salary records"}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.effective_date")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.base_salary")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.currency")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.frequency")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salary.map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px" }}>{format(new Date(s.effective_date), "MMM d, yyyy")}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>{Number(s.base_salary).toLocaleString()}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{s.currency}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{s.pay_frequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </OpsCard>
          )}

          {/* Attendance Tab */}
          {tab === "attendance" && (
            <OpsCard>
              {attendance.length === 0 ? (
                <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  {t("hr_mgmt.attendance.no_records") !== "hr_mgmt.attendance.no_records" ? t("hr_mgmt.attendance.no_records") : "No attendance records"}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.date")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.clock_in")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.clock_out")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.hours")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px" }}>{format(new Date(a.date), "MMM d, yyyy")}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{a.clock_in ? format(new Date(a.clock_in), "HH:mm") : "—"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{a.clock_out ? format(new Date(a.clock_out), "HH:mm") : "—"}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 500 }}>{a.total_hours != null ? `${a.total_hours}h` : "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                            background: a.status === "present" ? "#10B98120" : a.status === "absent" ? "#EF444420" : a.status === "late" ? "#F59E0B20" : "#6B728020",
                            color: a.status === "present" ? "#10B981" : a.status === "absent" ? "#EF4444" : a.status === "late" ? "#F59E0B" : "#6B7280",
                          }}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </OpsCard>
          )}

          {/* Reviews Tab */}
          {tab === "reviews" && (
            <OpsCard>
              {reviews.length === 0 ? (
                <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  {t("hr_mgmt.reviews.no_reviews") !== "hr_mgmt.reviews.no_reviews" ? t("hr_mgmt.reviews.no_reviews") : "No performance reviews"}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.review_date")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.period")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.rating")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((r) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px" }}>{format(new Date(r.review_date), "MMM d, yyyy")}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{r.review_period || "—"}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#C9A84C" }}>{r.rating != null ? `${r.rating}/5` : "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                            background: r.status === "completed" ? "#10B98120" : "#F59E0B20",
                            color: r.status === "completed" ? "#10B981" : "#F59E0B",
                          }}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </OpsCard>
          )}

          {/* Training Tab */}
          {tab === "training" && (
            <OpsCard>
              {training.length === 0 ? (
                <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  {t("hr_mgmt.training.no_enrollments") !== "hr_mgmt.training.no_enrollments" ? t("hr_mgmt.training.no_enrollments") : "No training enrollments"}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.course")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.enrolled")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.completed")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.score")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {training.map((tr) => (
                      <tr key={tr.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 500 }}>{tr.course_title}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{format(new Date(tr.enrolled_at), "MMM d, yyyy")}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{tr.completed_at ? format(new Date(tr.completed_at), "MMM d, yyyy") : "—"}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#C9A84C" }}>{tr.score != null ? `${tr.score}%` : "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                            background: tr.status === "completed" ? "#10B98120" : tr.status === "in_progress" ? "#3B82F620" : "#6B728020",
                            color: tr.status === "completed" ? "#10B981" : tr.status === "in_progress" ? "#3B82F6" : "#6B7280",
                          }}>
                            {tr.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </OpsCard>
          )}

          {/* Assets Tab */}
          {tab === "assets" && (
            <OpsCard>
              {assets.length === 0 ? (
                <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                  {t("hr_mgmt.assets.no_assets")}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.asset")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.doc_type")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.serial")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.assigned")}</th>
                      <th style={{ textAlign: "start", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>{t("hr_mgmt.employees.field.returned")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontWeight: 500 }}>{a.asset_name}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{a.asset_type}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 12 }}>{a.serial_number || "—"}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                          {format(new Date(a.assigned_at), "MMM d, yyyy")}
                        </td>
                        <td style={{ padding: "10px 12px", color: a.returned_at ? "var(--text-secondary)" : "#10B981" }}>
                          {a.returned_at ? format(new Date(a.returned_at), "MMM d, yyyy") : t("hr_mgmt.employees.field.active")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </OpsCard>
          )}
        </>
      )}
    </OpsPageShell>
  );
}
