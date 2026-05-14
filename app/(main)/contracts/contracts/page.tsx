"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { OpsPageShell, OpsCard } from "@/components/operations/page-shell";
import { Loader2 } from "lucide-react";

interface ContractListItem {
  id: string;
  category: string;
  counterparty_name: string;
  project_id: string | null;
  title: string;
  expiration_date: string | null;
  monetary_value: number | null;
  currency: string | null;
  status: string;
  flagged_for_review: boolean;
  created_at: string;
}

const CATEGORY_FILTERS = ["", "customer", "subcontractor", "vendor"];
const STATUS_FILTERS = ["", "active", "expired", "terminated", "renewed", "draft"];

export default function ContractsList() {
  const { t } = useI18n();
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      const res = await fetch(`/api/contracts/contracts?${params.toString()}`);
      if (res.ok) setContracts((await res.json()).contracts || []);
    } finally {
      setLoading(false);
    }
  }, [category, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <OpsPageShell title={t("contracts.list.title")}>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
            {t("contracts.list.filter_category")}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border-light)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            {CATEGORY_FILTERS.map((c) => (
              <option key={c} value={c}>
                {c || "all"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
            {t("contracts.list.filter_status")}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border-light)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s || "all"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <OpsCard>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Loader2 className="animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", padding: 16, textAlign: "center" }}>
            {t("contracts.list.empty")}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "start", color: "var(--text-secondary)", fontSize: 11 }}>
                <th style={{ padding: 8 }}>title</th>
                <th style={{ padding: 8 }}>category</th>
                <th style={{ padding: 8 }}>counterparty</th>
                <th style={{ padding: 8 }}>expires</th>
                <th style={{ padding: 8 }}>value</th>
                <th style={{ padding: 8 }}>status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--border-light)" }}>
                  <td style={{ padding: 8 }}>
                    <Link
                      href={`/hr/contracts/contracts/${c.id}`}
                      style={{ color: "#C9A84C", textDecoration: "none" }}
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td style={{ padding: 8, color: "var(--text-secondary)" }}>
                    {t(`contracts.category.${c.category}`) || c.category}
                  </td>
                  <td style={{ padding: 8 }}>{c.counterparty_name}</td>
                  <td style={{ padding: 8, color: "var(--text-secondary)" }}>
                    {c.expiration_date || "—"}
                  </td>
                  <td style={{ padding: 8 }}>
                    {c.monetary_value != null
                      ? `${c.monetary_value} ${c.currency || ""}`.trim()
                      : "—"}
                  </td>
                  <td style={{ padding: 8 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        background:
                          c.status === "active"
                            ? "rgba(26,86,168,0.1)"
                            : c.status === "expired"
                            ? "rgba(163,45,45,0.1)"
                            : "rgba(0,0,0,0.05)",
                        fontSize: 11,
                      }}
                    >
                      {t(`contracts.status.${c.status}`) || c.status}
                    </span>
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
