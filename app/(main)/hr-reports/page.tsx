"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import {
  Loader2,
  Users,
  Wallet,
  Clock,
  CalendarDays,
  Award,
  FileSignature,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

interface Overview {
  generated_at: string;
  headcount: {
    active: number;
    total: number;
    new_hires_this_year: number;
    by_department: Record<string, number>;
    by_status: Record<string, number>;
  };
  payroll: {
    monthly_cost: number;
    employees_with_salary: number;
    payslips_this_month: number;
  };
  attendance: {
    records_this_month: number;
    by_status: Record<string, number>;
    total_hours: number;
    overtime_hours: number;
  };
  leave: { pending: number; approved_this_year: number };
  conduct: { discipline_this_year: number; recognition_this_year: number };
  contracts: { active: number; expiring_soon: number };
}
interface Insights {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}

export default function HrReportsPage() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/hr-reports/overview")
      .then((r) => r.json())
      .then((d) => setOverview(d.error ? null : d))
      .finally(() => setLoading(false));
  }, []);

  const generateInsights = async () => {
    if (!overview) return;
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/hr-reports/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overview),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("hr_reports.insights_failed"));
        return;
      }
      setInsights(data);
    } finally {
      setInsightsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!overview) {
    return <div className="p-12 text-center text-muted-foreground">{t("hr_reports.load_failed")}</div>;
  }

  const peso = (n: number) => `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("hr_reports.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("hr_reports.subtitle")}</p>
        </div>
        <Button onClick={generateInsights} disabled={insightsLoading}>
          {insightsLoading ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="me-2 h-4 w-4" />
          )}
          {t("hr_reports.generate_insights")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          icon={Users}
          tone="blue"
          label={t("hr_reports.metric.headcount")}
          value={String(overview.headcount.active)}
          sub={t("hr_reports.metric.new_hires").replace(
            "{n}",
            String(overview.headcount.new_hires_this_year)
          )}
        />
        <Metric
          icon={Wallet}
          tone="emerald"
          label={t("hr_reports.metric.payroll")}
          value={peso(overview.payroll.monthly_cost)}
          sub={t("hr_reports.metric.payslips").replace(
            "{n}",
            String(overview.payroll.payslips_this_month)
          )}
        />
        <Metric
          icon={Clock}
          tone="amber"
          label={t("hr_reports.metric.attendance")}
          value={String(overview.attendance.records_this_month)}
          sub={t("hr_reports.metric.overtime").replace(
            "{n}",
            String(overview.attendance.overtime_hours)
          )}
        />
        <Metric
          icon={CalendarDays}
          tone="blue"
          label={t("hr_reports.metric.pending_leave")}
          value={String(overview.leave.pending)}
          sub={t("hr_reports.metric.approved_leave").replace(
            "{n}",
            String(overview.leave.approved_this_year)
          )}
        />
        <Metric
          icon={Award}
          tone="emerald"
          label={t("hr_reports.metric.conduct")}
          value={`${overview.conduct.recognition_this_year} / ${overview.conduct.discipline_this_year}`}
          sub={t("hr_reports.metric.conduct_sub")}
        />
        <Metric
          icon={FileSignature}
          tone={overview.contracts.expiring_soon > 0 ? "rose" : "blue"}
          label={t("hr_reports.metric.contracts")}
          value={String(overview.contracts.active)}
          sub={t("hr_reports.metric.expiring").replace(
            "{n}",
            String(overview.contracts.expiring_soon)
          )}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title={t("hr_reports.breakdown.department")}
          data={overview.headcount.by_department}
        />
        <Breakdown
          title={t("hr_reports.breakdown.attendance")}
          data={overview.attendance.by_status}
        />
      </div>

      {insights && (
        <div className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{t("hr_reports.ai_briefing")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{insights.summary}</p>
          <div className="grid gap-4 md:grid-cols-3">
            <InsightList
              icon={TrendingUp}
              tone="emerald"
              title={t("hr_reports.highlights")}
              items={insights.highlights}
            />
            <InsightList
              icon={AlertTriangle}
              tone="amber"
              title={t("hr_reports.concerns")}
              items={insights.concerns}
            />
            <InsightList
              icon={Lightbulb}
              tone="blue"
              title={t("hr_reports.recommendations")}
              items={insights.recommendations}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
};

function Metric({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {entries.length === 0 ? (
        <div className="text-sm text-muted-foreground">—</div>
      ) : (
        <ul className="space-y-2">
          {entries.map(([key, count]) => (
            <li key={key} className="text-sm">
              <div className="flex items-center justify-between">
                <span className="capitalize">{key.replace(/_/g, " ")}</span>
                <span className="font-medium tabular-nums">{count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InsightList({
  icon: Icon,
  tone,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">—</div>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONES[tone]}`} />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
