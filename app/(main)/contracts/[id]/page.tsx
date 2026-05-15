"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Calendar,
  CalendarClock,
  CalendarX,
  CalendarCheck,
  DollarSign,
  Building2,
  Mail,
  Phone,
  User,
  FileText,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Obligation {
  party: string;
  obligation: string;
  due_date?: string | null;
}
interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  resolved_at: string | null;
  created_at: string;
}
interface Contract {
  id: string;
  title: string;
  category: string;
  counterparty_name: string;
  counterparty_contact_name: string | null;
  counterparty_contact_email: string | null;
  counterparty_contact_phone: string | null;
  summary: string | null;
  signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  monetary_value: number | null;
  currency: string | null;
  is_renewable: boolean;
  status: string;
  flagged_for_review: boolean;
  obligations_json: Obligation[] | null;
  created_at: string;
  alerts: Alert[];
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  expired: "bg-rose-50 text-rose-700 ring-rose-200/60",
  pending: "bg-amber-50 text-amber-700 ring-amber-200/60",
  draft: "bg-slate-50 text-slate-700 ring-slate-200/60",
  terminated: "bg-rose-50 text-rose-700 ring-rose-200/60",
};

const STATUSES = ["active", "pending", "draft", "expired", "terminated"];

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchContract = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setContract(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setStatus = async (newStatus: string) => {
    if (!contract || newStatus === contract.status) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(t("contracts.detail.status_updated"));
        await fetchContract();
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("contracts.detail.confirm_delete"))) return;
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("contracts.detail.deleted"));
      router.push("/contracts");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!contract) {
    return <div className="p-12 text-center text-muted-foreground">{t("contracts.detail.not_found")}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/contracts"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("contracts.title")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{contract.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{contract.category}</span>
              <span>·</span>
              <span>{contract.counterparty_name}</span>
              <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[contract.status] || ""}`}>
                {contract.status}
              </Badge>
              {contract.flagged_for_review && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 ring-1 ring-amber-200/60">
                  <AlertTriangle className="me-1 h-3 w-3" />
                  {t("contracts.detail.flagged")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={contract.status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={updating}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {contract.summary && (
            <Section title={t("contracts.detail.summary")}>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{contract.summary}</p>
            </Section>
          )}

          <Section title={t("contracts.detail.dates")}>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <DateCell icon={Calendar} label={t("contracts.form.signing_date")} value={contract.signing_date} />
              <DateCell icon={CalendarCheck} label={t("contracts.form.effective_date")} value={contract.effective_date} />
              <DateCell icon={CalendarX} label={t("contracts.form.expiration_date")} value={contract.expiration_date} />
              <DateCell icon={CalendarClock} label={t("contracts.form.renewal_date")} value={contract.renewal_date} />
            </div>
          </Section>

          <Section title={t("contracts.detail.financials")}>
            <div className="flex items-center gap-3 text-sm">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-semibold">
                  {contract.monetary_value != null ? contract.monetary_value.toLocaleString() : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {contract.currency || "—"}
                  {contract.is_renewable && ` · ${t("contracts.detail.renewable_badge")}`}
                </div>
              </div>
            </div>
          </Section>

          {contract.obligations_json && contract.obligations_json.length > 0 && (
            <Section title={t("contracts.detail.obligations")}>
              <ul className="space-y-2 text-sm">
                {contract.obligations_json.map((o, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={
                        o.party === "us"
                          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60"
                          : "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60"
                      }
                    >
                      {o.party}
                    </Badge>
                    <div className="flex-1">
                      <div>{o.obligation}</div>
                      {o.due_date && <div className="text-xs text-muted-foreground">{formatDate(o.due_date)}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <Section title={t("contracts.detail.counterparty")}>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {contract.counterparty_name}
              </div>
              {contract.counterparty_contact_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {contract.counterparty_contact_name}
                </div>
              )}
              {contract.counterparty_contact_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${contract.counterparty_contact_email}`} className="text-primary hover:underline">
                    {contract.counterparty_contact_email}
                  </a>
                </div>
              )}
              {contract.counterparty_contact_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {contract.counterparty_contact_phone}
                </div>
              )}
            </div>
          </Section>

          {contract.alerts && contract.alerts.length > 0 && (
            <Section title={t("contracts.detail.alerts")}>
              <ul className="space-y-2 text-xs">
                {contract.alerts.map((a) => (
                  <li key={a.id} className="rounded border bg-card p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.type}</span>
                      {a.resolved_at ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">
                          {t("contracts.detail.resolved")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 ring-1 ring-rose-200/60">
                          {a.severity}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground">{a.message}</div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={t("contracts.detail.metadata")}>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>
                <FileText className="me-1 inline h-3 w-3" />
                {t("contracts.detail.created")}: {formatDate(contract.created_at)}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function DateCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-medium">{value ? formatDate(value) : "—"}</div>
    </div>
  );
}
