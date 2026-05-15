"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Upload, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { ProfileExtraTabs, type ExtraTab } from "@/components/hr/employees/tabs/ProfileExtraTabs";
import { useUser } from "@/lib/auth/context";

type Tab =
  | "details" | "documents" | "history" | "leave" | "assets"
  | ExtraTab;

interface Employee {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  position?: string | null;
  hire_date?: string | null;
  employment_type?: string | null;
  manager_id?: string | null;
  status?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  national_id?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
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

const TABS: { key: Tab; labelKey: string }[] = [
  { key: "details", labelKey: "hr_mgmt.employees.tab_details" },
  { key: "documents", labelKey: "hr_mgmt.employees.tab_documents" },
  { key: "history", labelKey: "hr_mgmt.employees.tab_history" },
  { key: "leave", labelKey: "hr_mgmt.employees.tab_leave" },
  { key: "assets", labelKey: "hr_mgmt.employees.tab_assets" },
  { key: "contract", labelKey: "hr_mgmt.employees.tab_contract" },
  { key: "salary_schedule", labelKey: "hr_mgmt.employees.tab_salary_schedule" },
  { key: "benefits", labelKey: "hr_mgmt.employees.tab_benefits" },
  { key: "discipline_recognition", labelKey: "hr_mgmt.employees.tab_discipline_recognition" },
  { key: "compliance", labelKey: "hr_mgmt.employees.tab_compliance" },
  { key: "notes", labelKey: "hr_mgmt.employees.tab_notes" },
  { key: "alerts", labelKey: "hr_mgmt.employees.tab_alerts" },
  { key: "access", labelKey: "hr_mgmt.employees.tab_access" },
];

const EXTRA_TAB_KEYS: ExtraTab[] = [
  "contract",
  "salary_schedule",
  "benefits",
  "discipline_recognition",
  "compliance",
  "notes",
  "alerts",
  "access",
];

function isExtraTab(t: Tab): t is ExtraTab {
  return (EXTRA_TAB_KEYS as Tab[]).includes(t);
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
  cancelled: "#6B7280",
};

export default function EmployeeDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = params.id as string;
  const { isAdmin } = useUser();
  const [tab, setTab] = useState<Tab>("details");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/operations/employees")
      .then((r) => r.json())
      .then((d) => {
        const emp = (d.employees || []).find((e: Employee) => e.id === id);
        setEmployee(emp || null);
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
        } else if (tab === "history") {
          const res = await fetch(`/api/hr/employees/${id}/history`, { signal });
          const data = await res.json();
          setHistory(data.history || []);
        } else if (tab === "leave") {
          const res = await fetch(`/api/hr/leave?employee_id=${id}`, { signal });
          const data = await res.json();
          setLeaves(data.requests || []);
        } else if (tab === "assets") {
          const res = await fetch(`/api/hr/assets/assignments?employee_id=${id}`, { signal });
          const data = await res.json();
          setAssets(data.assignments || []);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("Failed to load tab data", e);
        }
      } finally {
        setTabLoading(false);
      }
    };

    // Legacy loader only handles the original 4 tabs (documents,
    // history, leave, assets). The new gap-fill tabs fetch their
    // own data inside ProfileExtraTabs.
    if (tab !== "details" && !isExtraTab(tab)) {
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
      <OpsPageShell title={t("hr_mgmt.employees.title")}>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      </OpsPageShell>
    );
  }

  if (!employee) {
    return (
      <OpsPageShell title={t("hr_mgmt.employees.title")}>
        <OpsCard>
          <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
            Employee not found
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

  return (
    <OpsPageShell
      title={employee.full_name}
      subtitle={employee.position || undefined}
      actions={
        <Link
          href="/hr-management/employees"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "8px 14px", borderRadius: 8, fontSize: 13,
            color: "var(--text-secondary)", textDecoration: "none",
            border: "1px solid var(--border-light)", background: "var(--bg-card)",
          }}
        >
          <ArrowLeft size={14} /> {t("common.back")}
        </Link>
      }
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border-light)", paddingBottom: 0 }}>
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "none", background: "none",
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
                {infoRow("Full Name", employee.full_name)}
                {infoRow("Email", employee.email)}
                {infoRow("Phone", employee.phone)}
                {infoRow("Date of Birth", employee.date_of_birth ? format(new Date(employee.date_of_birth), "MMM d, yyyy") : null)}
                {infoRow("Address", employee.address)}
                {infoRow("National ID", employee.national_id)}
              </OpsCard>
              <OpsCard title={t("hr_mgmt.employees.employment_info")}>
                {infoRow("Position", employee.position)}
                {infoRow("Department", employee.department_name)}
                {infoRow("Employment Type", employee.employment_type)}
                {infoRow("Hire Date", employee.hire_date ? format(new Date(employee.hire_date), "MMM d, yyyy") : null)}
                {infoRow("Status", employee.status)}
              </OpsCard>
              <OpsCard title={t("hr_mgmt.employees.emergency_contact")}>
                {infoRow("Name", employee.emergency_contact_name)}
                {infoRow("Phone", employee.emergency_contact_phone)}
                {infoRow("Relation", employee.emergency_contact_relation)}
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
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Name</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Type</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Uploaded</th>
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
                  No history records
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
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Type</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Dates</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Days</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Status</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Reason</th>
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
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Asset</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Type</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Serial #</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Assigned</th>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Returned</th>
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
                          {a.returned_at ? format(new Date(a.returned_at), "MMM d, yyyy") : "Active"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </OpsCard>
          )}

          {/* Gap-fill tabs from migration 012. Each tab manages its
              own data-fetching and forms inside ProfileExtraTabs. */}
          {isExtraTab(tab) && (
            <ProfileExtraTabs employeeId={id} tab={tab} isAdmin={isAdmin} />
          )}
        </>
      )}
    </OpsPageShell>
  );
}
