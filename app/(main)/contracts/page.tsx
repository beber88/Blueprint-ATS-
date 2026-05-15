"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { FileText, Search, Loader2, AlertCircle, Plus, Bell } from "lucide-react";
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

interface SynthesizedAlert {
  pseudo_id: string;
  contract_id: string;
  contract_title: string;
  type: string;
  severity: string;
  message: string;
  due_date: string;
}

export default function ContractsPage() {
  const { t } = useI18n();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [alerts, setAlerts] = useState<SynthesizedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/contracts/alerts")
      .then((r) => r.json())
      .then((d) => setAlerts(d.synthesized || []));
  }, []);

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("contracts.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("contracts.subtitle")}</p>
        </div>
        <Link href="/contracts/new">
          <Button>
            <Plus className="me-2 h-4 w-4" />
            {t("contracts.new.cta")}
          </Button>
        </Link>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Bell className="h-4 w-4" />
            {t("contracts.alerts.title")} ({alerts.length})
          </div>
          <ul className="space-y-1 text-xs text-amber-900">
            {alerts.slice(0, 5).map((a) => (
              <li key={a.pseudo_id} className="flex items-center gap-2">
                <Link href={`/contracts/${a.contract_id}`} className="font-medium hover:underline">
                  {a.contract_title}
                </Link>
                <span>·</span>
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/20"
                  onClick={() => (window.location.href = `/contracts/${c.id}`)}
                >
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
