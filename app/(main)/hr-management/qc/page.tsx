"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import {
  Loader2,
  Copy,
  ClipboardCheck,
  GitMerge,
  AlertTriangle,
} from "lucide-react";

interface QcEmployee {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  employee_code: string | null;
}
interface DuplicatePair {
  a: QcEmployee;
  b: QcEmployee;
  score: number;
  reasons: string[];
}
interface Issue {
  field: string;
  severity: "high" | "medium" | "low";
}
interface FlaggedEmployee {
  id: string;
  full_name: string | null;
  issues: Issue[];
}
interface DataQuality {
  scanned: number;
  clean: number;
  flagged: number;
  by_severity: { high: number; medium: number; low: number };
  employees: FlaggedEmployee[];
}

const SEV_BG: Record<string, string> = {
  high: "#fef2f2",
  medium: "#fffbeb",
  low: "#f1f5f9",
};
const SEV_FG: Record<string, string> = {
  high: "#b91c1c",
  medium: "#b45309",
  low: "#475569",
};

export default function HrQcPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"duplicates" | "quality">("duplicates");
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [scanned, setScanned] = useState(0);
  const [quality, setQuality] = useState<DataQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const url = tab === "duplicates" ? "/api/hr/qc/duplicates" : "/api/hr/qc/data-quality";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (tab === "duplicates") {
          setPairs(d.pairs || []);
          setScanned(d.scanned || 0);
        } else {
          setQuality(d.error ? null : d);
        }
      })
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const tabBtn = (k: "duplicates" | "quality", icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTab(k)}
      style={{
        background: "transparent",
        border: 0,
        padding: "8px 14px",
        cursor: "pointer",
        color: tab === k ? "var(--primary, #2563eb)" : "var(--text-secondary)",
        borderBottom: tab === k ? "2px solid var(--primary, #2563eb)" : "2px solid transparent",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <OpsPageShell title={t("hr_mgmt.qc.title")} subtitle={t("hr_mgmt.qc.subtitle")}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: "#111827",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 13,
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        {tabBtn("duplicates", <Copy size={14} />, t("hr_mgmt.qc.tabs.duplicates"))}
        {tabBtn("quality", <ClipboardCheck size={14} />, t("hr_mgmt.qc.tabs.quality"))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60, color: "var(--text-secondary)" }}>
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : tab === "duplicates" ? (
        <DuplicatesView pairs={pairs} scanned={scanned} onMerged={load} flash={flash} />
      ) : (
        <QualityView quality={quality} />
      )}
    </OpsPageShell>
  );
}

function DuplicatesView({
  pairs,
  scanned,
  onMerged,
  flash,
}: {
  pairs: DuplicatePair[];
  scanned: number;
  onMerged: () => void;
  flash: (msg: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
        {t("hr_mgmt.qc.duplicates.scanned").replace("{n}", String(scanned))}
      </p>
      {pairs.length === 0 ? (
        <OpsCard>
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
            {t("hr_mgmt.qc.duplicates.none")}
          </div>
        </OpsCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pairs.map((p, i) => (
            <DuplicateCard key={i} pair={p} onMerged={onMerged} flash={flash} />
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicateCard({
  pair,
  onMerged,
  flash,
}: {
  pair: DuplicatePair;
  onMerged: () => void;
  flash: (msg: string) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const merge = async (keepId: string, mergeId: string) => {
    if (!window.confirm(t("hr_mgmt.qc.duplicates.confirm_merge"))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/hr/qc/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_id: keepId, merge_id: mergeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.error || t("hr_mgmt.qc.duplicates.merge_failed"));
        return;
      }
      flash(t("hr_mgmt.qc.duplicates.merged"));
      onMerged();
    } finally {
      setBusy(false);
    }
  };

  const confidence = pair.score >= 0.8 ? "high" : pair.score >= 0.6 ? "medium" : "low";

  return (
    <OpsCard>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <span
          style={{
            background: SEV_BG[confidence],
            color: SEV_FG[confidence],
            padding: "3px 10px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 500,
            border: `1px solid ${SEV_FG[confidence]}30`,
          }}
        >
          {t(`hr_mgmt.qc.confidence.${confidence}`)} · {Math.round(pair.score * 100)}%
        </span>
        {pair.reasons.map((r) => (
          <span
            key={r}
            style={{
              background: "var(--surface-2, #f8fafc)",
              padding: "3px 8px",
              borderRadius: 10,
              fontSize: 11,
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {t(`hr_mgmt.qc.reason.${r}`)}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <EmployeeCol emp={pair.a} other={pair.b} busy={busy} onMerge={merge} />
        <EmployeeCol emp={pair.b} other={pair.a} busy={busy} onMerge={merge} />
      </div>
    </OpsCard>
  );
}

function EmployeeCol({
  emp,
  other,
  busy,
  onMerge,
}: {
  emp: QcEmployee;
  other: QcEmployee;
  busy: boolean;
  onMerge: (keepId: string, mergeId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      style={{
        background: "var(--surface-2, #f8fafc)",
        padding: 12,
        borderRadius: 6,
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: 6 }}>{emp.full_name || "—"}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "grid", gap: 2 }}>
        <Row label={t("hr_mgmt.qc.field.email")} value={emp.email} />
        <Row label={t("hr_mgmt.qc.field.phone")} value={emp.phone} />
        <Row label={t("hr_mgmt.qc.field.national_id")} value={emp.national_id} />
        <Row label={t("hr_mgmt.qc.field.employee_code")} value={emp.employee_code} />
      </div>
      <button
        disabled={busy}
        onClick={() => onMerge(emp.id, other.id)}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "6px 10px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 6,
          cursor: busy ? "not-allowed" : "pointer",
          fontSize: 12,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <GitMerge size={13} />
        {t("hr_mgmt.qc.duplicates.keep_this")}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span>{label}</span>
      <span style={{ color: value ? "var(--text-primary)" : "var(--text-tertiary, #94a3b8)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function QualityView({ quality }: { quality: DataQuality | null }) {
  const { t } = useI18n();
  if (!quality) {
    return (
      <OpsCard>
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
          {t("hr_mgmt.qc.quality.load_failed")}
        </div>
      </OpsCard>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Stat label={t("hr_mgmt.qc.quality.scanned")} value={quality.scanned} />
        <Stat label={t("hr_mgmt.qc.quality.clean")} value={quality.clean} tone="#059669" />
        <Stat label={t("hr_mgmt.qc.quality.flagged")} value={quality.flagged} tone="#b45309" />
        <Stat label={t("hr_mgmt.qc.quality.high_issues")} value={quality.by_severity.high} tone="#b91c1c" />
      </div>

      {quality.employees.length === 0 ? (
        <OpsCard>
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
            {t("hr_mgmt.qc.quality.all_clean")}
          </div>
        </OpsCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quality.employees.map((e) => (
            <OpsCard key={e.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 500 }}>{e.full_name || "—"}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {e.issues.length} {t("hr_mgmt.qc.quality.issues")}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {e.issues.map((iss) => (
                  <span
                    key={iss.field}
                    style={{
                      background: SEV_BG[iss.severity],
                      color: SEV_FG[iss.severity],
                      padding: "3px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                      border: `1px solid ${SEV_FG[iss.severity]}30`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {iss.severity === "high" && <AlertTriangle size={10} />}
                    {t(`hr_mgmt.qc.issue.${iss.field}`)}
                  </span>
                ))}
              </div>
            </OpsCard>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <OpsCard>
      <div style={{ fontSize: 24, fontWeight: 600, color: tone || "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</div>
    </OpsCard>
  );
}
