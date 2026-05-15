"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, ShieldCheck, AlertTriangle, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Doc {
  id: string;
  employee_id: string;
  document_type: string;
  title: string;
  file_url: string | null;
  original_language: string | null;
  expiry_date: string | null;
  created_at: string;
  employee: { id: string; full_name: string; national_id: string | null } | null;
}

interface Compliance {
  id: string;
  full_name: string;
  national_id: string | null;
  filled_count: number;
  total_count: number;
  missing: string[];
}

export default function GovernmentPage() {
  const { t } = useI18n();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [compliance, setCompliance] = useState<Compliance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/government-documents")
      .then((r) => r.json())
      .then((data) => {
        setDocs(data.documents || []);
        setCompliance(data.compliance || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const incomplete = compliance.filter((c) => c.filled_count < c.total_count);
  const complete = compliance.filter((c) => c.filled_count === c.total_count);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("government.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("government.subtitle")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={ShieldCheck}
              label={t("government.summary.complete")}
              value={complete.length}
              tone="emerald"
            />
            <SummaryCard
              icon={AlertTriangle}
              label={t("government.summary.incomplete")}
              value={incomplete.length}
              tone="amber"
            />
            <SummaryCard
              icon={FileText}
              label={t("government.summary.total_documents")}
              value={docs.length}
              tone="blue"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">{t("government.compliance.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("government.compliance.subtitle")}</p>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {incomplete.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">{t("government.compliance.all_good")}</div>
                ) : (
                  <ul className="divide-y">
                    {incomplete.map((c) => (
                      <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium">{c.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {t("government.compliance.missing")}: {c.missing.join(", ")}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 ring-1 ring-amber-200/60">
                          {c.filled_count}/{c.total_count}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold">{t("government.documents.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("government.documents.subtitle")}</p>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {docs.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">{t("government.documents.empty")}</div>
                ) : (
                  <ul className="divide-y">
                    {docs.map((d) => (
                      <li key={d.id} className="px-4 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{d.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {d.employee?.full_name || "—"} · {d.document_type}
                              {d.expiry_date && (
                                <span className="ms-2 text-amber-600">
                                  {t("government.documents.expires")}: {formatDate(d.expiry_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          {d.file_url && (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              {t("government.documents.open")}
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "blue";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}
