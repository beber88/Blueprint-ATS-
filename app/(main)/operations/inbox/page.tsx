"use client";

import { useEffect, useState } from "react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface InboxItem {
  id: string;
  from_phone: string;
  body: string | null;
  media_urls: string[] | null;
  twilio_message_sid: string;
  claimed_employee_id: string | null;
  resulting_report_id: string | null;
  received_at: string;
  claimed?: { full_name: string } | null;
}
interface Emp { id: string; full_name: string; phone: string | null }

export default function InboxPage() {
  const { t } = useI18n();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [ir, er] = await Promise.all([
      fetch("/api/operations/inbox").then((r) => r.json()),
      fetch("/api/operations/employees").then((r) => r.json()),
    ]);
    setInbox(ir.inbox || []);
    setEmps(er.employees || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const claim = async (id: string) => {
    const employee_id = picks[id];
    if (!employee_id) {
      toast.error(t("operations.inbox.pick_employee"));
      return;
    }
    const res = await fetch(`/api/operations/inbox/${id}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id }),
    });
    if (res.ok) {
      toast.success(t("operations.toast.claimed"));
      load();
    } else {
      toast.error(t("common.error"));
    }
  };

  return (
    <OpsPageShell title={t("operations.nav.inbox")} subtitle={t("operations.inbox.subtitle")}>
      <OpsCard>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin" /></div>
        ) : inbox.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{t("operations.empty.no_inbox")}</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {inbox.map((m) => (
              <li key={m.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ direction: "ltr", color: "var(--text-secondary)", fontSize: 12 }}>{m.from_phone}</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{m.received_at?.slice(0, 16)}</span>
                </div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>{m.body || <i style={{ color: "var(--text-secondary)" }}>(no text)</i>}</div>
                {Array.isArray(m.media_urls) && m.media_urls.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {m.media_urls.length} attachment(s)
                  </div>
                )}
                {m.resulting_report_id ? (
                  <div style={{ marginTop: 8, color: "#2D7A3E", fontSize: 12 }}>
                    ✓ {t("operations.inbox.claimed_by")}: {m.claimed?.full_name || "—"}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <select
                      value={picks[m.id] || ""}
                      onChange={(e) => setPicks({ ...picks, [m.id]: e.target.value })}
                      style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--border-primary)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)" }}
                    >
                      <option value="">{t("operations.inbox.pick_employee")}</option>
                      {emps.map((e) => (
                        <option key={e.id} value={e.id}>{e.full_name}{e.phone ? ` · ${e.phone}` : ""}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => claim(m.id)}
                      style={{ padding: "6px 14px", background: "#C9A84C", color: "#1A1A1A", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                    >
                      {t("operations.inbox.claim")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
