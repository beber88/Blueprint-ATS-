"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/shared/loading";
import {
  Users, UserPlus, Calendar, CheckCircle, Upload, Briefcase, Plus, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import Link from "next/link";
import { DashboardStats } from "@/types";
import { formatDateTime, getStatusLabel } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  new: "#6b7280",
  reviewed: "#3b82f6",
  shortlisted: "#6366f1",
  interview_scheduled: "#9333ea",
  interviewed: "#8b5cf6",
  approved: "#22c55e",
  rejected: "#ef4444",
  keep_for_future: "#f59e0b",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoading />;

  const kpis = [
    {
      title: "סה״כ מועמדים",
      value: stats?.total_candidates || 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "חדשים השבוע",
      value: stats?.new_this_week || 0,
      icon: UserPlus,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "ראיונות מתוכננים",
      value: stats?.interviews_scheduled || 0,
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "אושרו החודש",
      value: stats?.approved_this_month || 0,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div>
      <Header title="לוח בקרה" subtitle="סקירת תהליך הגיוס" />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {kpi.title}
                    </p>
                    <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${kpi.bg}`}>
                    <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Link href="/candidates?upload=true">
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              העלאת קו״ח
            </Button>
          </Link>
          <Link href="/jobs?new=true">
            <Button variant="outline">
              <Briefcase className="mr-2 h-4 w-4" />
              משרה חדשה
            </Button>
          </Link>
          <Link href="/interviews?new=true">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              קביעת ראיון
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pipeline by Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">סקירת Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.pipeline_by_status && stats.pipeline_by_status.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={stats.pipeline_by_status.map((item) => ({
                      name: getStatusLabel(item.status),
                      count: item.count,
                      status: item.status,
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {stats.pipeline_by_status.map((item) => (
                        <Cell
                          key={item.status}
                          fill={STATUS_COLORS[item.status] || "#6b7280"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  אין מועמדים עדיין
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                פעילות אחרונה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(stats?.recent_activity || []).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm border-b last:border-0 pb-3 last:pb-0"
                  >
                    <div className="mt-1 h-2 w-2 rounded-full bg-electric-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {(activity as unknown as { candidate?: { full_name: string } }).candidate?.full_name || "Unknown"}
                      </p>
                      <p className="text-muted-foreground">
                        {getStatusLabel(activity.action)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(activity.created_at)}
                    </span>
                  </div>
                ))}
                {(!stats?.recent_activity || stats.recent_activity.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    אין פעילות אחרונה
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Jobs */}
        {stats?.top_jobs && stats.top_jobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">משרות פעילות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.top_jobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{job.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.candidate_count} מועמדים
                      </p>
                    </div>
                    {job.top_score != null && job.top_score > 0 && (
                      <span className="text-sm font-medium text-green-600">
                        ציון עליון: {job.top_score}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
