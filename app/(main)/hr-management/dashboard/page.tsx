"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Users, Calendar, Star, ClipboardCheck, FileText, HardDrive, Baby, UserPlus } from "lucide-react";
import Link from "next/link";

interface Stats {
  employees: { total: number; active: number; inactive: number; new_this_month: number; upcoming_birthdays: number };
  leave: { pending: number };
  reviews: { total: number };
  attendance: { today_present: number; today_total: number };
  compliance: { with_documents: number; total_active: number; percent: number };
  departments: Record<string, number>;
  drive: Record<string, number>;
}

function KpiCard({ icon: Icon, label, value, sub, color, href }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string; href?: string;
}) {
  const card = (
    <div className="rounded-lg border p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
        <Icon className="h-4 w-4" style={color ? { color } : undefined} />
        <span>{label}</span>
      </div>
      <p className="text-3xl font-bold" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="no-underline">{card}</Link> : card;
}

const DEPT_COLORS = ["#C9A84C", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316", "#84CC16"];

export default function HRDashboardPage() {
  const { locale } = useI18n();
  const isHe = locale === "he";
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hr/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-6 text-center text-muted-foreground">Failed to load dashboard</div>;
  }

  const deptEntries = Object.entries(stats.departments).sort((a, b) => b[1] - a[1]);
  const maxDept = Math.max(...deptEntries.map(([, v]) => v), 1);

  return (
    <div className="p-6 space-y-6" dir={isHe ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold">{isHe ? "דשבורד HR" : "HR Dashboard"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isHe ? "מבט-על על כל ה-HR במסך אחד" : "Bird's eye view of your entire HR"}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={Users} label={isHe ? "עובדים פעילים" : "Active Employees"}
          value={stats.employees.active}
          sub={`${stats.employees.inactive} ${isHe ? "לא פעילים" : "inactive"}`}
          href="/hr/hr-management/employees"
        />
        <KpiCard
          icon={UserPlus} label={isHe ? "עובדים חדשים החודש" : "New Hires This Month"}
          value={stats.employees.new_this_month}
          color="#10B981"
        />
        <KpiCard
          icon={Calendar} label={isHe ? "חופשות ממתינות" : "Pending Leave"}
          value={stats.leave.pending}
          color={stats.leave.pending > 0 ? "#F59E0B" : undefined}
          href="/hr/hr-management/leave"
        />
        <KpiCard
          icon={ClipboardCheck} label={isHe ? "נוכחים היום" : "Present Today"}
          value={stats.attendance.today_present}
          sub={`/ ${stats.employees.active} ${isHe ? "עובדים" : "employees"}`}
          href="/hr/hr-management/attendance"
        />
        <KpiCard
          icon={Star} label={isHe ? "הערכות ביצועים" : "Performance Reviews"}
          value={stats.reviews.total}
          href="/hr/hr-management/reviews"
        />
        <KpiCard
          icon={FileText} label={isHe ? "התאמת מסמכים" : "Document Compliance"}
          value={`${stats.compliance.percent}%`}
          sub={`${stats.compliance.with_documents}/${stats.compliance.total_active} ${isHe ? "עם מסמכים" : "with docs"}`}
          color={stats.compliance.percent < 50 ? "#EF4444" : stats.compliance.percent < 80 ? "#F59E0B" : "#10B981"}
        />
        <KpiCard
          icon={Baby} label={isHe ? "ימי הולדת קרובים" : "Upcoming Birthdays"}
          value={stats.employees.upcoming_birthdays}
          sub={isHe ? "ב-30 הימים הקרובים" : "in next 30 days"}
        />
        <KpiCard
          icon={HardDrive} label={isHe ? "קבצי דרייב" : "Drive Files"}
          value={Object.values(stats.drive).reduce((s, v) => s + v, 0)}
          sub={`${stats.drive.routed || 0} ${isHe ? "נותבו" : "routed"}`}
          href="/hr/hr-management/drive-sync"
        />
      </div>

      {/* Department Distribution */}
      <div className="rounded-lg border p-4">
        <h2 className="font-bold text-lg mb-4">{isHe ? "עובדים לפי מחלקה" : "Employees by Department"}</h2>
        <div className="space-y-3">
          {deptEntries.map(([dept, count], i) => (
            <div key={dept} className="flex items-center gap-3">
              <span className="text-sm w-[140px] truncate text-muted-foreground">{dept}</span>
              <div className="flex-1 h-6 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(count / maxDept) * 100}%`,
                    backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length],
                    minWidth: 24,
                  }}
                />
              </div>
              <span className="text-sm font-bold w-8 text-end">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}