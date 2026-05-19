"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, HardDrive, CheckCircle, AlertCircle, Clock, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface DriveFile {
  id: string;
  drive_file_id: string;
  name: string;
  mime_type: string;
  parent_folder_path: string | null;
  classification_status: string;
  target_table: string | null;
  document_type: string | null;
  target_employee_id: string | null;
  employee?: { full_name: string } | null;
  created_at: string;
}

interface SyncState {
  status: string;
  last_sync_at: string | null;
  files_seen: number;
  files_imported: number;
  files_skipped: number;
  files_errored: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  classified: "bg-blue-100 text-blue-800",
  routed: "bg-green-100 text-green-800",
  skipped: "bg-gray-100 text-gray-600",
  error: "bg-red-100 text-red-800",
  needs_review: "bg-orange-100 text-orange-800",
};

export default function DriveSyncPage() {
  const { locale } = useI18n();
  const isHe = locale === "he";

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [totalFiles, setTotalFiles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [statusRes, filesRes] = await Promise.all([
      fetch("/api/drive/status").then((r) => r.json()),
      fetch(`/api/drive/files?limit=100${filterStatus !== "all" ? `&status=${filterStatus}` : ""}${search ? `&search=${search}` : ""}`).then((r) => r.json()),
    ]);
    setSyncState(statusRes.sync_state || null);
    setFileCounts(statusRes.file_counts || {});
    setTotalFiles(statusRes.total_files || 0);
    setFiles(filesRes.files || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [filterStatus]);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/drive/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(isHe
        ? `סנכרון הושלם: ${data.stats.routed} קבצים נותבו`
        : `Sync complete: ${data.stats.routed} files routed`);
      loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const doSearch = () => loadData();

  return (
    <div className="p-6 space-y-6" dir={isHe ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isHe ? "סנכרון Google Drive" : "Google Drive Sync"}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isHe ? "ניהול קבצים מסונכרנים מתיקיית הדרייב של החברה" : "Manage files synced from the company Drive folder"}
          </p>
        </div>
        <Button onClick={triggerSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <RefreshCw className="h-4 w-4 me-2" />}
          {isHe ? "סנכרן עכשיו" : "Sync Now"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <HardDrive className="h-4 w-4" />
            {isHe ? "סה\"כ קבצים" : "Total Files"}
          </div>
          <p className="text-2xl font-bold">{totalFiles}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
            <CheckCircle className="h-4 w-4" />
            {isHe ? "נותבו" : "Routed"}
          </div>
          <p className="text-2xl font-bold text-green-600">{fileCounts.routed || 0}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
            <AlertCircle className="h-4 w-4" />
            {isHe ? "דורשים סקירה" : "Needs Review"}
          </div>
          <p className="text-2xl font-bold text-orange-600">{(fileCounts.needs_review || 0) + (fileCounts.pending || 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Clock className="h-4 w-4" />
            {isHe ? "סנכרון אחרון" : "Last Sync"}
          </div>
          <p className="text-sm font-medium">
            {syncState?.last_sync_at
              ? new Date(syncState.last_sync_at).toLocaleDateString(isHe ? "he-IL" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              : (isHe ? "טרם סונכרן" : "Never")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isHe ? "חיפוש קבצים..." : "Search files..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            className="ps-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isHe ? "הכל" : "All"}</SelectItem>
            <SelectItem value="routed">{isHe ? "נותבו" : "Routed"}</SelectItem>
            <SelectItem value="pending">{isHe ? "ממתינים" : "Pending"}</SelectItem>
            <SelectItem value="needs_review">{isHe ? "דורשים סקירה" : "Needs Review"}</SelectItem>
            <SelectItem value="error">{isHe ? "שגיאות" : "Errors"}</SelectItem>
            <SelectItem value="skipped">{isHe ? "דילוג" : "Skipped"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Files Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{isHe ? "אין קבצים מסונכרנים עדיין" : "No synced files yet"}</p>
          <p className="text-sm mt-1">{isHe ? "לחץ \"סנכרן עכשיו\" כדי להתחיל" : "Click \"Sync Now\" to start"}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-start py-2 px-3">{isHe ? "שם קובץ" : "File Name"}</th>
                <th className="text-start py-2 px-3">{isHe ? "תיקייה" : "Folder"}</th>
                <th className="text-start py-2 px-3">{isHe ? "סטטוס" : "Status"}</th>
                <th className="text-start py-2 px-3">{isHe ? "טבלת יעד" : "Target"}</th>
                <th className="text-start py-2 px-3">{isHe ? "עובד" : "Employee"}</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-t hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium max-w-[250px] truncate">{f.name}</td>
                  <td className="py-2 px-3 text-muted-foreground text-xs max-w-[200px] truncate">{f.parent_folder_path || "—"}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[f.classification_status] || "bg-gray-100"}`}>
                      {f.classification_status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-xs">{f.target_table || "—"}</td>
                  <td className="py-2 px-3 text-xs">{f.employee?.full_name || "—"}</td>
                  <td className="py-2 px-3">
                    {f.drive_file_id && (
                      <a
                        href={`https://drive.google.com/file/d/${f.drive_file_id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
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
