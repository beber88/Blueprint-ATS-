"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { FileText, Search, Loader2, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Contract {
  id: string;
  title: string;
  category: string;
  counterparty_name: string;
  status: string;
  signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  monetary_value: number | null;
  currency: string | null;
  is_renewable: boolean;
  flagged_for_review: boolean;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  expired: "bg-rose-50 text-rose-700 ring-rose-200/60",
  pending: "bg-amber-50 text-amber-700 ring-amber-200/60",
  draft: "bg-slate-50 text-slate-700 ring-slate-200/60",
  terminated: "bg-rose-50 text-rose-700 ring-rose-200/60",
};

export default function ContractsPage() {
  const { t } = useI18n();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        const res = await fetch(`/api/contracts?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setContracts(data.contracts || []);
        }
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(fetchData, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("contracts.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("contracts.subtitle")}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("common.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-8 w-8" />
          {t("contracts.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("contracts.col.title")}</th>
                <th className="px-4 py-3 text-start">{t("contracts.col.counterparty")}</th>
                <th className="px-4 py-3 text-start">{t("contracts.col.category")}</th>
                <th className="px-4 py-3 text-start">{t("contracts.col.status")}</th>
                <th className="px-4 py-3 text-start">{t("contracts.col.expiration")}</th>
                <th className="px-4 py-3 text-start">{t("contracts.col.value")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {c.flagged_for_review && (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      {c.title}
                    </div>
                  </td>
                  <td className="px-4 py-3">{c.counterparty_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.category}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[c.status] || ""}`}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.expiration_date ? formatDate(c.expiration_date) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.monetary_value != null ? `${c.monetary_value.toLocaleString()} ${c.currency || ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
