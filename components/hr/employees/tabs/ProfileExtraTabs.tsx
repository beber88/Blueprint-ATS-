"use client";

// Profile-gap-fill tabs that depend on migration 012's nine new
// hr_* tables. Rendered by the existing employee detail page when
// the user switches to one of the new tabs; existing tabs (details,
// documents, history, leave, assets) are still inlined on the
// parent page untouched.
//
// Kept in one file for now: every tab is a small list-with-empty-state
// + an inline-create row. Splitting into per-tab files is a
// round-2 refactor.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, X, Plus, Trash2 } from "lucide-react";
import { OpsCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { format } from "date-fns";

export type ExtraTab =
  | "contract"
  | "salary_schedule"
  | "benefits"
  | "discipline_recognition"
  | "compliance"
  | "notes"
  | "alerts"
  | "access";

interface Props {
  employeeId: string;
  tab: ExtraTab;
  isAdmin: boolean;
}

// ──────────────────────────────────────────────────────────────────
// Shared atoms
// ──────────────────────────────────────────────────────────────────

const cellHeader: React.CSSProperties = {
  textAlign: "start",
  padding: "8px 12px",
  color: "var(--text-secondary)",
  fontWeight: 500,
  fontSize: 12,
};

const cell: React.CSSProperties = {
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
};

function EmptyState({ label }: { label: string }) {
  return (
    <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
      {label}
    </p>
  );
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return format(new Date(s), "MMM d, yyyy");
  } catch {
    return s;
  }
}

function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const cur = currency || "";
  return `${amount.toLocaleString()} ${cur}`.trim();
}

// ──────────────────────────────────────────────────────────────────
// Hook: fetch+state for a single tab's resource
// ──────────────────────────────────────────────────────────────────

function useResource<T>(url: string | null, key: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(url);
      const json = await res.json();
      const list = (json[key] as T[] | undefined) ?? [];
      setData(list);
    } catch (e) {
      console.error("Failed to load resource", e);
    } finally {
      setLoading(false);
    }
  }, [url, key]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, loading, reload };
}

// ──────────────────────────────────────────────────────────────────
// Tab: Employment Contract
// ──────────────────────────────────────────────────────────────────

interface EmploymentContract {
  id: string;
  employment_type: string;
  start_date: string;
  end_date: string | null;
  probation_period_days: number | null;
  notice_period_days: number | null;
  working_hours_per_week: number | null;
  salary_base: number | null;
  currency: string | null;
  terms_text: string | null;
  status: string;
}

function ContractTab({ employeeId }: { employeeId: string }) {
  const { t } = useI18n();
  const { data, loading, reload } = useResource<EmploymentContract>(
    `/api/hr/employment-contracts?employee_id=${employeeId}`,
    "contracts"
  );
  const [showForm, setShowForm] = useState(false);

  return (
    <OpsCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t("hr_mgmt.employees.tab_contract") || "Contract"}</h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={btnPrimary}
        >
          <Plus size={12} /> {showForm ? t("common.cancel") : "New"}
        </button>
      </div>

      {showForm && (
        <ContractForm
          employeeId={employeeId}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      {loading ? (
        <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
      ) : data.length === 0 ? (
        <EmptyState label={t("hr_mgmt.employees.no_contracts") || "No contracts yet"} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
              <th style={cellHeader}>Type</th>
              <th style={cellHeader}>Period</th>
              <th style={cellHeader}>Salary</th>
              <th style={cellHeader}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={cell}>{c.employment_type}</td>
                <td style={cell}>
                  {fmtDate(c.start_date)} → {c.end_date ? fmtDate(c.end_date) : "—"}
                </td>
                <td style={cell}>{fmtMoney(c.salary_base, c.currency)}</td>
                <td style={cell}>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsCard>
  );
}

function ContractForm({ employeeId, onCreated }: { employeeId: string; onCreated: () => void }) {
  const { t } = useI18n();
  const [employmentType, setEmploymentType] = useState("permanent");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [salaryBase, setSalaryBase] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      toast.error("Start date required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/employment-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          employment_type: employmentType,
          start_date: startDate,
          end_date: endDate || null,
          salary_base: salaryBase ? parseFloat(salaryBase) : null,
          currency,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      onCreated();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={formRow}>
      <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} style={inputStyle}>
        <option value="permanent">permanent</option>
        <option value="fixed_term">fixed_term</option>
        <option value="probation">probation</option>
        <option value="consultant">consultant</option>
        <option value="intern">intern</option>
      </select>
      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} placeholder="Start" />
      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} placeholder="End" />
      <input
        type="number"
        step="0.01"
        value={salaryBase}
        onChange={(e) => setSalaryBase(e.target.value)}
        style={inputStyle}
        placeholder="Salary"
      />
      <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} style={{ ...inputStyle, width: 60 }} maxLength={3} placeholder="CUR" />
      <button type="submit" disabled={submitting} style={btnPrimary}>
        <Check size={12} /> {submitting ? "..." : "Save"}
      </button>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab: Salary Schedules
// ──────────────────────────────────────────────────────────────────

interface SalarySchedule {
  id: string;
  scheduled_date: string;
  expected_amount: number;
  currency: string | null;
  reason: string | null;
  status: string;
  applied_at: string | null;
}

function SalaryScheduleTab({ employeeId }: { employeeId: string }) {
  const { t } = useI18n();
  const { data, loading, reload } = useResource<SalarySchedule>(
    `/api/hr/salary-schedules?employee_id=${employeeId}`,
    "schedules"
  );
  const [showForm, setShowForm] = useState(false);

  const act = async (id: string, action: "apply" | "cancel") => {
    try {
      const res = await fetch(`/api/hr/salary-schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      reload();
    } catch (e) {
      toast.error((e as Error).message || t("common.error"));
    }
  };

  return (
    <OpsCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Salary Schedules</h3>
        <button onClick={() => setShowForm((s) => !s)} style={btnPrimary}>
          <Plus size={12} /> {showForm ? "Cancel" : "New"}
        </button>
      </div>
      {showForm && (
        <SalaryScheduleForm
          employeeId={employeeId}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}
      {loading ? (
        <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
      ) : data.length === 0 ? (
        <EmptyState label="No scheduled salary changes" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
              <th style={cellHeader}>Date</th>
              <th style={cellHeader}>Amount</th>
              <th style={cellHeader}>Reason</th>
              <th style={cellHeader}>Status</th>
              <th style={cellHeader}></th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={cell}>{fmtDate(s.scheduled_date)}</td>
                <td style={cell}>{fmtMoney(s.expected_amount, s.currency)}</td>
                <td style={cell}>{s.reason || "—"}</td>
                <td style={cell}>{s.status}</td>
                <td style={cell}>
                  {s.status === "pending" && (
                    <>
                      <button onClick={() => act(s.id, "apply")} style={btnSmall} title="Apply now">
                        <Check size={12} />
                      </button>
                      <button onClick={() => act(s.id, "cancel")} style={btnSmall} title="Cancel">
                        <X size={12} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsCard>
  );
}

function SalaryScheduleForm({ employeeId, onCreated }: { employeeId: string; onCreated: () => void }) {
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !amount) {
      toast.error("Date and amount required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/salary-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          scheduled_date: date,
          expected_amount: parseFloat(amount),
          currency,
          reason: reason || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={formRow}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="Amount" />
      <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} style={{ ...inputStyle, width: 60 }} maxLength={3} />
      <input value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Reason" />
      <button type="submit" disabled={submitting} style={btnPrimary}>
        <Check size={12} /> Save
      </button>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab: Benefits
// ──────────────────────────────────────────────────────────────────

interface Benefit {
  id: string;
  type: string;
  monthly_value: number | null;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

function BenefitsTab({ employeeId }: { employeeId: string }) {
  const { data, loading, reload } = useResource<Benefit>(
    `/api/hr/benefits?employee_id=${employeeId}`,
    "benefits"
  );
  const [showForm, setShowForm] = useState(false);

  const remove = async (id: string) => {
    if (!confirm("Delete this benefit?")) return;
    await fetch(`/api/hr/benefits/${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <OpsCard>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Benefits & Allowances</h3>
        <button onClick={() => setShowForm((s) => !s)} style={btnPrimary}>
          <Plus size={12} /> {showForm ? "Cancel" : "New"}
        </button>
      </div>
      {showForm && (
        <BenefitForm
          employeeId={employeeId}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}
      {loading ? (
        <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
      ) : data.length === 0 ? (
        <EmptyState label="No benefits configured" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
              <th style={cellHeader}>Type</th>
              <th style={cellHeader}>Value</th>
              <th style={cellHeader}>Period</th>
              <th style={cellHeader}>Notes</th>
              <th style={cellHeader}></th>
            </tr>
          </thead>
          <tbody>
            {data.map((b) => (
              <tr key={b.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={cell}>{b.type}</td>
                <td style={cell}>{fmtMoney(b.monthly_value, b.currency)}</td>
                <td style={cell}>{fmtDate(b.start_date)} → {b.end_date ? fmtDate(b.end_date) : "ongoing"}</td>
                <td style={cell}>{b.notes || "—"}</td>
                <td style={cell}>
                  <button onClick={() => remove(b.id)} style={btnSmall} title="Delete">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsCard>
  );
}

function BenefitForm({ employeeId, onCreated }: { employeeId: string; onCreated: () => void }) {
  const [type, setType] = useState("health");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/benefits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          type,
          monthly_value: value ? parseFloat(value) : null,
          currency,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={formRow}>
      <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
        {["health", "transport", "meal", "phone", "education", "car", "housing", "bonus_target", "other"].map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle} placeholder="Monthly value" />
      <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} style={{ ...inputStyle, width: 60 }} maxLength={3} />
      <button type="submit" disabled={submitting} style={btnPrimary}>
        <Check size={12} /> Save
      </button>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab: Discipline + Recognition (two panels)
// ──────────────────────────────────────────────────────────────────

interface Disciplinary {
  id: string;
  action_date: string;
  action_type: string;
  description: string | null;
  status: string;
}

interface Recognition {
  id: string;
  date: string;
  type: string;
  title: string;
  monetary_amount: number | null;
  currency: string | null;
}

function DisciplineRecognitionTab({ employeeId }: { employeeId: string }) {
  const discipline = useResource<Disciplinary>(
    `/api/hr/disciplinary?employee_id=${employeeId}`,
    "records"
  );
  const recognition = useResource<Recognition>(
    `/api/hr/recognitions?employee_id=${employeeId}`,
    "recognitions"
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
      <OpsCard title="Disciplinary Records">
        {discipline.loading ? (
          <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
        ) : discipline.data.length === 0 ? (
          <EmptyState label="No disciplinary records" />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={cellHeader}>Date</th>
                <th style={cellHeader}>Type</th>
                <th style={cellHeader}>Status</th>
              </tr>
            </thead>
            <tbody>
              {discipline.data.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={cell}>{fmtDate(d.action_date)}</td>
                  <td style={cell}>{d.action_type}</td>
                  <td style={cell}>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </OpsCard>

      <OpsCard title="Recognitions">
        {recognition.loading ? (
          <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
        ) : recognition.data.length === 0 ? (
          <EmptyState label="No recognitions" />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={cellHeader}>Date</th>
                <th style={cellHeader}>Type</th>
                <th style={cellHeader}>Title</th>
                <th style={cellHeader}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recognition.data.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={cell}>{fmtDate(r.date)}</td>
                  <td style={cell}>{r.type}</td>
                  <td style={cell}>{r.title}</td>
                  <td style={cell}>{fmtMoney(r.monetary_amount, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </OpsCard>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab: Compliance
// ──────────────────────────────────────────────────────────────────

interface Compliance {
  id: string;
  record_type: string;
  identifier_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
}

function ComplianceTab({ employeeId }: { employeeId: string }) {
  const { data, loading } = useResource<Compliance>(
    `/api/hr/compliance?employee_id=${employeeId}`,
    "records"
  );

  return (
    <OpsCard title="Government Compliance">
      {loading ? (
        <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
      ) : data.length === 0 ? (
        <EmptyState label="No compliance records" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
              <th style={cellHeader}>Type</th>
              <th style={cellHeader}>Number</th>
              <th style={cellHeader}>Issued</th>
              <th style={cellHeader}>Expires</th>
              <th style={cellHeader}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={cell}>{c.record_type}</td>
                <td style={cell}>{c.identifier_number || "—"}</td>
                <td style={cell}>{fmtDate(c.issue_date)}</td>
                <td style={cell}>{fmtDate(c.expiry_date)}</td>
                <td style={cell}>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsCard>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab: Notes
// ──────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  note_text: string;
  visibility: string;
  pinned: boolean;
  author_id: string | null;
  created_at: string;
}

function NotesTab({ employeeId }: { employeeId: string }) {
  const { data, loading, reload } = useResource<Note>(
    `/api/hr/notes?employee_id=${employeeId}`,
    "notes"
  );
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/hr/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId, note_text: text }),
      });
      if (!res.ok) throw new Error(await res.text());
      setText("");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/hr/notes/${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <OpsCard title="Internal Notes">
      <form onSubmit={submit} style={{ marginBottom: 16 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note…"
          style={{
            width: "100%", minHeight: 60, padding: 8, fontSize: 13,
            border: "1px solid var(--border-light)", borderRadius: 6,
            background: "var(--bg-card)", color: "var(--text-primary)", resize: "vertical",
          }}
        />
        <button type="submit" disabled={submitting || !text.trim()} style={{ ...btnPrimary, marginTop: 6 }}>
          <Check size={12} /> {submitting ? "..." : "Add note"}
        </button>
      </form>
      {loading ? (
        <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
      ) : data.length === 0 ? (
        <EmptyState label="No notes yet" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map((n) => (
            <div key={n.id} style={{
              padding: 12, borderRadius: 6,
              background: n.pinned ? "#C9A84C10" : "var(--bg-subtle)",
              borderInlineStart: n.pinned ? "3px solid #C9A84C" : "3px solid transparent",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {n.pinned ? "📌 " : ""}{fmtDate(n.created_at)} • {n.visibility}
                </span>
                <button onClick={() => remove(n.id)} style={btnSmall}><Trash2 size={11} /></button>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{n.note_text}</div>
            </div>
          ))}
        </div>
      )}
    </OpsCard>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab: Alerts
// ──────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string | null;
  resolved_at: string | null;
  created_at: string;
}

function AlertsTab({ employeeId }: { employeeId: string }) {
  const { data, loading, reload } = useResource<Alert>(
    `/api/hr/alerts?employee_id=${employeeId}&resolved=false`,
    "alerts"
  );

  const resolve = async (id: string) => {
    await fetch(`/api/hr/alerts?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    reload();
  };

  return (
    <OpsCard title="Open Alerts">
      {loading ? (
        <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
      ) : data.length === 0 ? (
        <EmptyState label="No open alerts — all caught up" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
              <th style={cellHeader}>Created</th>
              <th style={cellHeader}>Type</th>
              <th style={cellHeader}>Severity</th>
              <th style={cellHeader}>Message</th>
              <th style={cellHeader}></th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={cell}>{fmtDate(a.created_at)}</td>
                <td style={cell}>{a.type}</td>
                <td style={cell}>{a.severity}</td>
                <td style={cell}>{a.message || "—"}</td>
                <td style={cell}>
                  <button onClick={() => resolve(a.id)} style={btnSmall} title="Resolve">
                    <Check size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsCard>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab: Access (admin only)
// ──────────────────────────────────────────────────────────────────

interface Grant {
  id: string;
  user_id: string;
  granted_by_user_id: string;
  granted_at: string;
  expires_at: string | null;
  note: string | null;
}

function AccessTab({ employeeId, isAdmin }: { employeeId: string; isAdmin: boolean }) {
  const { data, loading, reload } = useResource<Grant>(
    isAdmin ? `/api/hr/grants?employee_id=${employeeId}` : null,
    "grants"
  );
  const [userId, setUserId] = useState("");
  const [note, setNote] = useState("");

  if (!isAdmin) {
    return (
      <OpsCard>
        <EmptyState label="Admin-only section" />
      </OpsCard>
    );
  }

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    try {
      const res = await fetch("/api/hr/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, employee_id: employeeId, note }),
      });
      if (!res.ok) throw new Error(await res.text());
      setUserId("");
      setNote("");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this access grant?")) return;
    await fetch(`/api/hr/grants/${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <OpsCard title="Profile Access Grants">
      <form onSubmit={grant} style={formRow}>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="User ID (auth.uid)" />
        <input value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Note (optional)" />
        <button type="submit" style={btnPrimary}>
          <Plus size={12} /> Grant
        </button>
      </form>
      {loading ? (
        <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C", margin: 24 }} />
      ) : data.length === 0 ? (
        <EmptyState label="No active grants" />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
              <th style={cellHeader}>User</th>
              <th style={cellHeader}>Granted</th>
              <th style={cellHeader}>Expires</th>
              <th style={cellHeader}>Note</th>
              <th style={cellHeader}></th>
            </tr>
          </thead>
          <tbody>
            {data.map((g) => (
              <tr key={g.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={cell}>{g.user_id}</td>
                <td style={cell}>{fmtDate(g.granted_at)}</td>
                <td style={cell}>{fmtDate(g.expires_at)}</td>
                <td style={cell}>{g.note || "—"}</td>
                <td style={cell}>
                  <button onClick={() => revoke(g.id)} style={btnSmall} title="Revoke">
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsCard>
  );
}

// ──────────────────────────────────────────────────────────────────
// Style helpers
// ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 13,
  border: "1px solid var(--border-light)",
  borderRadius: 6,
  background: "var(--bg-card)",
  color: "var(--text-primary)",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  background: "#C9A84C",
  color: "#1A1A1A",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const btnSmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 8px",
  marginInlineEnd: 4,
  fontSize: 11,
  background: "var(--bg-subtle)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-light)",
  borderRadius: 4,
  cursor: "pointer",
};

const formRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 12,
  flexWrap: "wrap",
};

// ──────────────────────────────────────────────────────────────────
// Dispatcher
// ──────────────────────────────────────────────────────────────────

export function ProfileExtraTabs({ employeeId, tab, isAdmin }: Props) {
  switch (tab) {
    case "contract":
      return <ContractTab employeeId={employeeId} />;
    case "salary_schedule":
      return <SalaryScheduleTab employeeId={employeeId} />;
    case "benefits":
      return <BenefitsTab employeeId={employeeId} />;
    case "discipline_recognition":
      return <DisciplineRecognitionTab employeeId={employeeId} />;
    case "compliance":
      return <ComplianceTab employeeId={employeeId} />;
    case "notes":
      return <NotesTab employeeId={employeeId} />;
    case "alerts":
      return <AlertsTab employeeId={employeeId} />;
    case "access":
      return <AccessTab employeeId={employeeId} isAdmin={isAdmin} />;
    default:
      return null;
  }
}
