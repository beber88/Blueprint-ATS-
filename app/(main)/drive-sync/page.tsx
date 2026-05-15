"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { Cloud, Loader2, RefreshCw, Play, AlertCircle, CheckCircle2, Folder } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface SyncState {
  id: string;
  root_folder_id: string;
  root_folder_name: string | null;
  status: "idle" | "running" | "paused" | "error" | "complete";
  files_seen: number;
  files_imported: number;
  files_skipped: number;
  files_duplicate: number;
  files_errored: number;
  started_at: string | null;
  last_progress_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  idle: "bg-slate-50 text-slate-700 ring-slate-200/60",
  running: "bg-blue-50 text-blue-700 ring-blue-200/60",
  complete: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  error: "bg-rose-50 text-rose-700 ring-rose-200/60",
  paused: "bg-amber-50 text-amber-700 ring-amber-200/60",
};

export default function DriveSyncPage() {
  const { t } = useI18n();
  const [syncs, setSyncs] = useState<SyncState[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderInput, setFolderInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [tickingId, setTickingId] = useState<string | null>(null);

  const fetchSyncs = useCallback(async () => {
    try {
      const res = await fetch("/api/drive/sync/status");
      if (res.ok) {
        const data = await res.json();
        setSyncs(data.syncs || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSyncs();
  }, [fetchSyncs]);

  // Auto-poll if any sync is running
  useEffect(() => {
    const hasRunning = syncs.some((s) => s.status === "running");
    if (!hasRunning) return;
    const interval = setInterval(fetchSyncs, 5000);
    return () => clearInterval(interval);
  }, [syncs, fetchSyncs]);

  const handleStart = async () => {
    if (!folderInput.trim()) {
      toast.error(t("drive_sync.folder_required"));
      return;
    }
    setStarting(true);
    try {
      const res = await fetch("/api/drive/sync/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_url: folderInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || err.error || t("drive_sync.start_failed"));
        return;
      }
      toast.success(t("drive_sync.started_toast"));
      setFolderInput("");
      await fetchSyncs();
    } finally {
      setStarting(false);
    }
  };

  const handleTick = async (id: string) => {
    setTickingId(id);
    try {
      const res = await fetch("/api/drive/sync/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncStateId: id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("drive_sync.tick_failed"));
        return;
      }
      await fetchSyncs();
    } finally {
      setTickingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("drive_sync.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("drive_sync.subtitle")}</p>
        </div>
        <Link href="/settings/integrations">
          <Button variant="outline" size="sm">
            <Cloud className="me-2 h-4 w-4" />
            {t("drive_sync.manage_connection")}
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="space-y-3">
          <div>
            <Label htmlFor="folder">{t("drive_sync.folder_label")}</Label>
            <p className="text-xs text-muted-foreground">{t("drive_sync.folder_help")}</p>
          </div>
          <div className="flex gap-2">
            <Input
              id="folder"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
            <Button onClick={handleStart} disabled={starting || !folderInput.trim()}>
              {starting ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="me-2 h-4 w-4" />
              )}
              {t("drive_sync.start")}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("drive_sync.history")}
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchSyncs}>
            <RefreshCw className="me-2 h-3.5 w-3.5" />
            {t("common.search")}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : syncs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            {t("drive_sync.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {syncs.map((sync) => (
              <SyncRow
                key={sync.id}
                sync={sync}
                onTick={() => handleTick(sync.id)}
                ticking={tickingId === sync.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SyncRow({
  sync,
  onTick,
  ticking,
}: {
  sync: SyncState;
  onTick: () => void;
  ticking: boolean;
}) {
  const { t } = useI18n();
  const showTick = sync.status === "running" || sync.status === "error" || sync.status === "idle";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-muted-foreground" />
            <div className="truncate font-medium">{sync.root_folder_name || sync.root_folder_id}</div>
            <Badge
              variant="outline"
              className={`ring-1 ${STATUS_COLOR[sync.status] || ""}`}
            >
              {t(`drive_sync.status.${sync.status}`)}
            </Badge>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-5">
            <Stat label={t("drive_sync.stats.seen")} value={sync.files_seen} />
            <Stat label={t("drive_sync.stats.imported")} value={sync.files_imported} highlight="emerald" />
            <Stat label={t("drive_sync.stats.duplicate")} value={sync.files_duplicate} />
            <Stat label={t("drive_sync.stats.skipped")} value={sync.files_skipped} />
            <Stat label={t("drive_sync.stats.errored")} value={sync.files_errored} highlight={sync.files_errored ? "rose" : undefined} />
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {t("drive_sync.started")}: {sync.started_at ? formatDateTime(sync.started_at) : "—"}
            </span>
            {sync.last_progress_at && (
              <span>
                {t("drive_sync.last_progress")}: {formatDateTime(sync.last_progress_at)}
              </span>
            )}
          </div>
          {sync.error_message && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-rose-50 p-2 text-xs text-rose-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{sync.error_message}</span>
            </div>
          )}
        </div>
        {showTick && (
          <Button size="sm" variant="outline" onClick={onTick} disabled={ticking}>
            {ticking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Play className="me-1.5 h-3.5 w-3.5" />
                {t("drive_sync.tick")}
              </>
            )}
          </Button>
        )}
        {sync.status === "complete" && (
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "emerald" | "rose";
}) {
  const color =
    highlight === "emerald"
      ? "text-emerald-700"
      : highlight === "rose"
        ? "text-rose-700"
        : "text-foreground";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
