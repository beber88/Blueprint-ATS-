"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Package } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Asset {
  id: string;
  asset_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  status: string;
  purchase_date: string | null;
  purchase_cost: number | null;
  assigned_to: { id: string; full_name: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  assigned: "bg-blue-50 text-blue-700 ring-blue-200/60",
  retired: "bg-slate-50 text-slate-700 ring-slate-200/60",
  lost: "bg-rose-50 text-rose-700 ring-rose-200/60",
  damaged: "bg-amber-50 text-amber-700 ring-amber-200/60",
};

export default function AssetsPage() {
  const { t } = useI18n();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => setAssets(d.assets || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("assets.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("assets.subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8" />
          {t("assets.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("assets.col.tag")}</th>
                <th className="px-4 py-3 text-start">{t("assets.col.type")}</th>
                <th className="px-4 py-3 text-start">{t("assets.col.brand")}</th>
                <th className="px-4 py-3 text-start">{t("assets.col.serial")}</th>
                <th className="px-4 py-3 text-start">{t("assets.col.assigned_to")}</th>
                <th className="px-4 py-3 text-start">{t("assets.col.status")}</th>
                <th className="px-4 py-3 text-start">{t("assets.col.purchase_date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assets.map((a) => (
                <tr key={a.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{a.asset_tag || "—"}</td>
                  <td className="px-4 py-3">{a.asset_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[a.brand, a.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{a.serial_number || "—"}</td>
                  <td className="px-4 py-3">{a.assigned_to?.full_name || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[a.status] || ""}`}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a.purchase_date ? formatDate(a.purchase_date) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
