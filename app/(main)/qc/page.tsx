"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import {
  Loader2,
  Copy,
  ClipboardCheck,
  GitMerge,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

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

const SEVERITY_COLOR: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 ring-rose-200/60",
  medium: "bg-amber-50 text-amber-700 ring-amber-200/60",
  low: "bg-slate-50 text-slate-700 ring-slate-200/60",
};

export default function QcPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"duplicates" | "quality">("duplicates");
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [scanned, setScanned] = useState(0);
  const [quality, setQuality] = useState<DataQuality | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const url = tab === "duplicates" ? "/api/qc/duplicates" : "/api/qc/data-quality";
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("qc.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("qc.subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b">
        <TabBtn active={tab === "duplicates"} onClick={() => setTab("duplicates")} icon={Copy}>
          {t("qc.tabs.duplicates")}
        </TabBtn>
        <TabBtn active={tab === "quality"} onClick={() => setTab("quality")} icon={ClipboardCheck}>
          {t("qc.tabs.quality")}
        </TabBtn>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "duplicates" ? (
        <DuplicatesView pairs={pairs} scanned={scanned} onMerged={load} />
      ) : (
        <QualityView quality={quality} />
      )}
    </div>
  );
}

function DuplicatesView({
  pairs,
  scanned,
  onMerged,
}: {
  pairs: DuplicatePair[];
  scanned: number;
  onMerged: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("qc.duplicates.scanned").replace("{n}", String(scanned))}
      </p>
      {pairs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {t("qc.duplicates.none")}
        </div>
      ) : (
        <ul className="space-y-3">
          {pairs.map((p, i) => (
            <DuplicateCard key={i} pair={p} onMerged={onMerged} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DuplicateCard({ pair, onMerged }: { pair: DuplicatePair; onMerged: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const merge = async (keepId: string, mergeId: string) => {
    if (!window.confirm(t("qc.duplicates.confirm_merge"))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/qc/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_id: keepId, merge_id: mergeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("qc.duplicates.merge_failed"));
        return;
      }
      toast.success(t("qc.duplicates.merged"));
      onMerged();
    } finally {
      setBusy(false);
    }
  };

  const confidence =
    pair.score >= 0.8 ? "high" : pair.score >= 0.6 ? "medium" : "low";

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="outline" className={`ring-1 ${SEVERITY_COLOR[confidence]}`}>
          {t(`qc.confidence.${confidence}`)} · {Math.round(pair.score * 100)}%
        </Badge>
        {pair.reasons.map((r) => (
          <Badge key={r} variant="outline" className="text-xs">
            {t(`qc.reason.${r}`) || r}
          </Badge>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <EmployeeCol emp={pair.a} other={pair.b} busy={busy} onMerge={merge} />
        <EmployeeCol emp={pair.b} other={pair.a} busy={busy} onMerge={merge} />
      </div>
    </li>
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
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="font-medium">{emp.full_name || "—"}</div>
      <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        <Row label={t("qc.field.email")} value={emp.email} />
        <Row label={t("qc.field.phone")} value={emp.phone} />
        <Row label={t("qc.field.national_id")} value={emp.national_id} />
        <Row label={t("qc.field.employee_code")} value={emp.employee_code} />
      </dl>
      <Button
        size="sm"
        variant="outline"
        className="mt-2 w-full"
        disabled={busy}
        onClick={() => onMerge(emp.id, other.id)}
      >
        <GitMerge className="me-2 h-3.5 w-3.5" />
        {t("qc.duplicates.keep_this")}
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className={value ? "text-foreground" : ""}>{value || "—"}</dd>
    </div>
  );
}

function QualityView({ quality }: { quality: DataQuality | null }) {
  const { t } = useI18n();
  if (!quality) {
    return <div className="p-12 text-center text-muted-foreground">{t("qc.quality.load_failed")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={t("qc.quality.scanned")} value={quality.scanned} />
        <Stat label={t("qc.quality.clean")} value={quality.clean} tone="emerald" />
        <Stat label={t("qc.quality.flagged")} value={quality.flagged} tone="amber" />
        <Stat label={t("qc.quality.high_issues")} value={quality.by_severity.high} tone="rose" />
      </div>

      {quality.employees.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {t("qc.quality.all_clean")}
        </div>
      ) : (
        <ul className="space-y-2">
          {quality.employees.map((e) => (
            <li key={e.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.full_name || "—"}</span>
                <span className="text-xs text-muted-foreground">
                  {e.issues.length} {t("qc.quality.issues")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.issues.map((iss) => (
                  <Badge
                    key={iss.field}
                    variant="outline"
                    className={`ring-1 ${SEVERITY_COLOR[iss.severity]}`}
                  >
                    {iss.severity === "high" && <AlertTriangle className="me-1 h-3 w-3" />}
                    {t(`qc.issue.${iss.field}`) || iss.field}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
      ? "text-amber-600"
      : tone === "rose"
      ? "text-rose-600"
      : "";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`relative rounded-none px-4 ${active ? "text-primary" : "text-muted-foreground"}`}
    >
      <Icon className="me-2 h-4 w-4" />
      {children}
      {active && <div className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary" />}
    </Button>
  );
}
