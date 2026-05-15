"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, ArrowLeft, FileText, Search, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface DriveFile {
  id: string;
  drive_file_id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  classification_status: string;
  classification: {
    document_type?: string;
    confidence?: number;
    employee_name?: string;
    target_table_hint?: string;
    summary?: string;
    reasoning?: string;
  } | null;
  document_type: string | null;
  target_table: string | null;
  target_employee_id: string | null;
  original_language: string | null;
  imported_at: string | null;
  created_at: string;
  error_log: { at: string; message: string }[] | null;
}

interface Employee {
  id: string;
  full_name: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-50 text-slate-700 ring-slate-200/60",
  classified: "bg-blue-50 text-blue-700 ring-blue-200/60",
  routed: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  duplicate: "bg-amber-50 text-amber-700 ring-amber-200/60",
  failed: "bg-rose-50 text-rose-700 ring-rose-200/60",
  skipped: "bg-slate-50 text-slate-500 ring-slate-200/60",
};

export default function DriveFilesPage() {
  const { t } = useI18n();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      const res = await fetch(`/api/drive/files?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    fetch("/api/employees?limit=200&includeInactive=true")
      .then((r) => r.json())
      .then((d) => setEmployees(d.employees || []));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return files;
    const q = search.toLowerCase();
    return files.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.classification?.employee_name?.toLowerCase().includes(q)
    );
  }, [files, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    files.forEach((f) => {
      c[f.classification_status] = (c[f.classification_status] || 0) + 1;
    });
    return c;
  }, [files]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/drive-sync"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("drive_sync.title")}
          </Link>
          <h1 className="text-2xl font-semibold">{t("drive_sync.files.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("drive_sync.files.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label={t("drive_sync.files.all")} active={!filter} count={files.length} onClick={() => setFilter("")} />
        {["pending", "classified", "routed", "failed", "duplicate", "skipped"].map((s) => (
          <FilterChip
            key={s}
            label={t(`drive_sync.files.status.${s}`)}
            active={filter === s}
            count={counts[s] || 0}
            onClick={() => setFilter(s)}
          />
        ))}
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
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {t("drive_sync.files.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <DriveFileRow
              key={f.id}
              file={f}
              employees={employees}
              onChanged={fetchFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
      }`}
    >
      {label} <span className="opacity-60">({count})</span>
    </button>
  );
}

function DriveFileRow({
  file,
  employees,
  onChanged,
}: {
  file: DriveFile;
  employees: Employee[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(file.target_employee_id || "");
  const [docType, setDocType] = useState(file.document_type || file.classification?.document_type || "other");
  const [target, setTarget] = useState(file.target_table || file.classification?.target_table_hint || "hr_employee_documents");
  const [saving, setSaving] = useState(false);

  const handleAction = async (action: "route" | "skip" | "save") => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (action === "skip") body.action = "skip";
      else {
        body.target_employee_id = employeeId || null;
        body.document_type = docType;
        body.target_table_hint = target;
        if (action === "route") body.action = "route";
      }
      const res = await fetch(`/api/drive/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("common.error"));
        return;
      }
      if (action === "route") {
        if (data.route_result?.routed) toast.success(t("drive_sync.files.routed_ok"));
        else toast.message(data.route_result?.reason || t("common.error"));
      } else if (action === "skip") {
        toast.success(t("drive_sync.files.skipped_ok"));
      } else {
        toast.success(t("common.success"));
      }
      onChanged();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-medium">{file.name}</div>
            <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[file.classification_status] || ""}`}>
              {t(`drive_sync.files.status.${file.classification_status}`)}
            </Badge>
            {file.classification?.confidence != null && (
              <span className="text-xs text-muted-foreground">{file.classification.confidence}%</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {file.classification?.employee_name && <span>👤 {file.classification.employee_name}</span>}
            {file.document_type && <span>{file.document_type}</span>}
            {file.original_language && file.original_language !== "unknown" && (
              <span className="uppercase">{file.original_language}</span>
            )}
            <span>{formatDate(file.created_at)}</span>
          </div>
          {file.classification?.summary && (
            <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{file.classification.summary}</div>
          )}
          {file.error_log && file.error_log.length > 0 && (
            <div className="mt-2 flex items-start gap-1 rounded bg-rose-50 p-2 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>{file.error_log[file.error_log.length - 1].message}</span>
            </div>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          {open ? t("common.cancel") : t("common.edit")}
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid gap-2 border-t pt-3 text-sm sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{t("employees.title")}</span>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{t("drive_sync.files.document_type")}</span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              {["contract", "id", "certificate", "payslip", "government", "warning", "achievement", "report", "attendance", "medical", "tax", "other"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">{t("drive_sync.files.target_table")}</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="hr_employee_documents">hr_employee_documents</option>
              <option value="hr_payslips">hr_payslips</option>
              <option value="ct_contracts">ct_contracts</option>
              <option value="hr_attendance">hr_attendance</option>
              <option value="skip">skip</option>
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-3">
            <Button size="sm" onClick={() => handleAction("route")} disabled={saving}>
              {t("drive_sync.files.save_and_route")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAction("save")} disabled={saving}>
              {t("common.save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => handleAction("skip")} disabled={saving}>
              {t("drive_sync.files.skip")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
