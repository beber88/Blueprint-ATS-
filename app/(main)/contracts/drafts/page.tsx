"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { Loader2 } from "lucide-react";

interface DraftListItem {
  id: string;
  status: string;
  source_kind: string;
  created_at: string;
  ai_output_json: { title?: string; counterparty_name?: string };
  warnings_json: Array<{ severity: string; code: string }>;
}

const STATUS_FILTERS = ["draft", "saved", "flagged", "discarded"];

export default function ContractsDraftsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<string>("draft");
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/drafts?status=${status}&limit=200`);
      if (res.ok) setDrafts((await res.json()).drafts || []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <OpsPageShell
      title={t("contracts.intake.title")}
      subtitle="drafts"
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-light)",
              background: status === s ? "#C9A84C" : "transparent",
              color: status === s ? "#1A1A1A" : "var(--text-primary)",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: status === s ? 600 : 400,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <OpsCard>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Loader2 className="animate-spin" />
          </div>
        ) : drafts.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", padding: 16, textAlign: "center" }}>
            —
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "start", color: "var(--text-secondary)", fontSize: 11 }}>
                <th style={{ padding: 8 }}>title</th>
                <th style={{ padding: 8 }}>counterparty</th>
                <th style={{ padding: 8 }}>source</th>
                <th style={{ padding: 8 }}>warnings</th>
                <th style={{ padding: 8 }}>created</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--border-light)" }}>
                  <td style={{ padding: 8 }}>
                    <Link
                      href={`/hr/contracts/preview/${d.id}`}
                      style={{ color: "#C9A84C", textDecoration: "none" }}
                    >
                      {d.ai_output_json?.title || "—"}
                    </Link>
                  </td>
                  <td style={{ padding: 8 }}>
                    {d.ai_output_json?.counterparty_name || "—"}
                  </td>
                  <td style={{ padding: 8, color: "var(--text-secondary)" }}>
                    {d.source_kind}
                  </td>
                  <td style={{ padding: 8 }}>
                    {d.warnings_json?.length || 0}
                  </td>
                  <td style={{ padding: 8, color: "var(--text-secondary)" }}>
                    {new Date(d.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </OpsCard>
    </OpsPageShell>
  );
}
