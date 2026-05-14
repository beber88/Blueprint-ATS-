"use client";

import { useEffect, useState } from "react";
import { OpsPageShell, OpsCard, KpiCard } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  serial_number?: string | null;
  status: string;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  notes?: string | null;
}

interface AssetAssignment {
  id: string;
  asset_id: string;
  asset_name?: string;
  employee_id: string;
  employee_name?: string;
  assigned_at: string;
  returned_at?: string | null;
  notes?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: "#10B981",
  assigned: "#3B82F6",
  maintenance: "#F59E0B",
  retired: "#6B7280",
  lost: "#EF4444",
};

export default function AssetsPage() {
  const { t } = useI18n();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", asset_type: "", serial_number: "", status: "available" });

  const load = async () => {
    setLoading(true);
    const [ar, asr] = await Promise.all([
      fetch("/api/hr/assets").then((r) => r.json()),
      fetch("/api/hr/assets/assignments").then((r) => r.json()),
    ]);
    setAssets(ar.assets || []);
    setAssignments(asr.assignments || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createAsset = async () => {
    if (!form.name || !form.asset_type) return;
    setBusy(true);
    try {
      const res = await fetch("/api/hr/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("common.saved_successfully"));
      setShowForm(false);
      setForm({ name: "", asset_type: "", serial_number: "", status: "available" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const filtered = assets.filter((a) => {
    const matchFilter = filter === "all" || a.status === filter;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.serial_number?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const assetHistory = selectedAsset ? assignments.filter((a) => a.asset_id === selectedAsset) : [];

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-light)",
    background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13,
  };

  return (
    <OpsPageShell
      title={t("hr_mgmt.assets.title")}
      subtitle={t("hr_mgmt.assets.subtitle")}
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
          {t("hr_mgmt.assets.new_asset")}
        </button>
      }
    >
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard label={t("hr_mgmt.assets.available")} value={assets.filter((a) => a.status === "available").length} accent="#10B981" />
        <KpiCard label={t("hr_mgmt.assets.assigned")} value={assets.filter((a) => a.status === "assigned").length} accent="#3B82F6" />
        <KpiCard label={t("hr_mgmt.assets.maintenance")} value={assets.filter((a) => a.status === "maintenance").length} accent="#F59E0B" />
        <KpiCard label={t("hr_mgmt.assets.retired")} value={assets.filter((a) => a.status === "retired").length} accent="#6B7280" />
      </div>

      {/* Search + Filter */}
      <OpsCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-secondary)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              style={{ ...inputStyle, width: "100%", paddingLeft: 30 }}
            />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "available", "assigned", "maintenance", "retired"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                  border: "none", cursor: "pointer",
                  background: filter === f ? "rgba(201,168,76,0.15)" : "transparent",
                  color: filter === f ? "#C9A84C" : "var(--text-secondary)",
                }}
              >
                {f === "all" ? t("hr_mgmt.email_inbox.all") : t(`hr_mgmt.assets.${f}`)}
              </button>
            ))}
          </div>
        </div>
      </OpsCard>

      {/* New asset form */}
      {showForm && (
        <OpsCard style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <input placeholder="Asset Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            <input placeholder="Type (e.g. Laptop, Phone)" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })} style={inputStyle} />
            <input placeholder="Serial Number" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} style={inputStyle} />
            <button onClick={createAsset} disabled={busy} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#C9A84C", color: "#1A1A1A", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
            </button>
          </div>
        </OpsCard>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selectedAsset ? "1fr 380px" : "1fr", gap: 16 }}>
        {/* Asset list */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
          </div>
        ) : filtered.length === 0 ? (
          <OpsCard>
            <p style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              {t("hr_mgmt.assets.no_assets")}
            </p>
          </OpsCard>
        ) : (
          <OpsCard>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Name</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Serial #</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: 500 }}>Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedAsset(selectedAsset === asset.id ? null : asset.id)}
                    style={{
                      borderBottom: "1px solid var(--border-light)", cursor: "pointer",
                      background: selectedAsset === asset.id ? "rgba(201,168,76,0.06)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary)" }}>{asset.name}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{asset.asset_type}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 12 }}>
                      {asset.serial_number || "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: `${STATUS_COLORS[asset.status] || "#6B7280"}20`,
                        color: STATUS_COLORS[asset.status] || "#6B7280",
                      }}>
                        {t(`hr_mgmt.assets.${asset.status}`)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
                      {asset.assigned_to_name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </OpsCard>
        )}

        {/* Assignment history panel */}
        {selectedAsset && (
          <OpsCard title="Assignment History">
            {assetHistory.length === 0 ? (
              <p style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)", fontSize: 13 }}>
                No assignment history
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {assetHistory.map((ah) => (
                  <div key={ah.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                      {ah.employee_name || ah.employee_id}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {format(new Date(ah.assigned_at), "MMM d, yyyy")}
                      {ah.returned_at ? ` — ${format(new Date(ah.returned_at), "MMM d, yyyy")}` : " — present"}
                    </div>
                    {ah.notes && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{ah.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </OpsCard>
        )}
      </div>
    </OpsPageShell>
  );
}
