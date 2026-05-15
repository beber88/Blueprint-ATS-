"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Clock, CalendarDays } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";

interface Employee {
  id: string;
  full_name: string;
}
interface AttendanceRow {
  id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
  status: string;
  source: string;
  employee: Employee | null;
}
interface LeaveRow {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  created_at: string;
  employee: Employee | null;
}

const STATUS_COLOR: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  absent: "bg-rose-50 text-rose-700 ring-rose-200/60",
  late: "bg-amber-50 text-amber-700 ring-amber-200/60",
  on_leave: "bg-blue-50 text-blue-700 ring-blue-200/60",
  pending: "bg-amber-50 text-amber-700 ring-amber-200/60",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200/60",
};

export default function AttendancePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"attendance" | "leave">("attendance");
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = tab === "attendance" ? "/api/attendance" : "/api/leave-requests";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (tab === "attendance") setAttendance(data.records || []);
        else setLeaves(data.requests || []);
      })
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("attendance.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("attendance.subtitle")}</p>
      </div>

      <div className="flex gap-2 border-b">
        <Button
          variant="ghost"
          onClick={() => setTab("attendance")}
          className={`relative rounded-none px-4 ${tab === "attendance" ? "text-primary" : "text-muted-foreground"}`}
        >
          <Clock className="me-2 h-4 w-4" />
          {t("attendance.tabs.attendance")}
          {tab === "attendance" && <div className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary" />}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setTab("leave")}
          className={`relative rounded-none px-4 ${tab === "leave" ? "text-primary" : "text-muted-foreground"}`}
        >
          <CalendarDays className="me-2 h-4 w-4" />
          {t("attendance.tabs.leave")}
          {tab === "leave" && <div className="absolute bottom-0 start-0 end-0 h-0.5 bg-primary" />}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === "attendance" ? (
        attendance.length === 0 ? (
          <Empty msg={t("attendance.empty.attendance")} />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">{t("attendance.col.employee")}</th>
                  <th className="px-4 py-3 text-start">{t("attendance.col.date")}</th>
                  <th className="px-4 py-3 text-start">{t("attendance.col.clock_in")}</th>
                  <th className="px-4 py-3 text-start">{t("attendance.col.clock_out")}</th>
                  <th className="px-4 py-3 text-end">{t("attendance.col.hours")}</th>
                  <th className="px-4 py-3 text-end">{t("attendance.col.overtime")}</th>
                  <th className="px-4 py-3 text-start">{t("attendance.col.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attendance.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{r.employee?.full_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.clock_in ? formatDateTime(r.clock_in) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.clock_out ? formatDateTime(r.clock_out) : "—"}</td>
                    <td className="px-4 py-3 text-end">{r.total_hours?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3 text-end text-muted-foreground">{r.overtime_hours?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[r.status] || ""}`}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : leaves.length === 0 ? (
        <Empty msg={t("attendance.empty.leave")} />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("attendance.col.employee")}</th>
                <th className="px-4 py-3 text-start">{t("attendance.col.leave_type")}</th>
                <th className="px-4 py-3 text-start">{t("attendance.col.range")}</th>
                <th className="px-4 py-3 text-end">{t("attendance.col.days")}</th>
                <th className="px-4 py-3 text-start">{t("attendance.col.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leaves.map((l) => (
                <tr key={l.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{l.employee?.full_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.leave_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(l.start_date)} — {formatDate(l.end_date)}
                  </td>
                  <td className="px-4 py-3 text-end">{l.days_count}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`ring-1 ${STATUS_COLOR[l.status] || ""}`}>{l.status}</Badge>
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

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      {msg}
    </div>
  );
}
