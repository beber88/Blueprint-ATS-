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
import { ScoreBadge } from "@/components/shared/score-badge";
import { useI18n } from "@/lib/i18n/context";

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

const STATUS_DOT_COLORS: Record<string, string> = {
  new: "bg-gray-500",
  reviewed: "bg-blue-500",
  shortlisted: "bg-indigo-500",
  interview_scheduled: "bg-purple-600",
  interviewed: "bg-violet-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  keep_for_future: "bg-amber-500",
};

export default function DashboardPage() {
  const { t } = useI18n();
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
      title: t("dashboard.total_candidates"),
      value: stats?.total_candidates || 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      iconBg: "bg-blue-100",
    },
    {
      title: t("dashboard.new_this_week"),
      value: stats?.new_this_week || 0,
      icon: UserPlus,
      color: "text-green-600",
      bg: "bg-green-50",
      iconBg: "bg-green-100",
    },
    {
      title: t("dashboard.interviews_scheduled"),
      value: stats?.interviews_scheduled || 0,
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-50",
      iconBg: "bg-purple-100",
    },
    {
      title: t("dashboard.approved_this_month"),
      value: stats?.approved_this_month || 0,
      icon: CheckCircle,
      color: "text-amber-600",
      bg: "bg-amber-50",
      iconBg: "bg-amber-100",
    },
  ];

  const todayDate = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <Header title={t("dashboard.title")} subtitle={todayDate} />
      <div className="p-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card
              key={kpi.title}
              className="rounded-xl shadow-sm border-0 overflow-hidden"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {kpi.title}
                    </p>
                    <p className="text-4xl font-bold tracking-tight">
                      {kpi.value}
                    </p>
                  </div>
                  <div
                    className={`rounded-2xl p-4 ${kpi.iconBg}`}
                  >
                    <kpi.icon className={`h-7 w-7 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Link href="/candidates?upload=true">
            <Button className="rounded-lg">
              <Upload className="mr-2 h-4 w-4" />
              {t("dashboard.upload_cv")}
            </Button>
          </Link>
          <Link href="/jobs?new=true">
            <Button variant="outline" className="rounded-lg">
              <Briefcase className="mr-2 h-4 w-4" />
              {t("dashboard.new_job")}
            </Button>
          </Link>
          <Link href="/interviews?new=true">
            <Button variant="outline" className="rounded-lg">
              <Plus className="mr-2 h-4 w-4" />
              {t("dashboard.schedule_interview")}
            </Button>
          </Link>
        </div>

        {/* Pipeline + Status Breakdown */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Pipeline Chart */}
          <Card className="lg:col-span-2 rounded-xl shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">
                {t("dashboard.pipeline")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.pipeline_by_status &&
              stats.pipeline_by_status.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
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
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={95}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
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
                <div className="flex items-center justify-center h-[320px]">
                  <p className="text-sm text-muted-foreground">
                    {t("candidates.no_candidates")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card className="rounded-xl shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">
                {t("dashboard.status_breakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.pipeline_by_status &&
              stats.pipeline_by_status.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {stats.pipeline_by_status.map((item) => (
                    <div
                      key={item.status}
                      className="rounded-xl bg-gray-50 p-3 flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            STATUS_DOT_COLORS[item.status] || "bg-gray-400"
                          }`}
                        />
                        <span className="text-xs text-muted-foreground truncate">
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                      <span className="text-2xl font-bold pr-4">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground">{t("common.no_results")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity + Active Jobs */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <Card className="rounded-xl shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-1.5">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                {t("dashboard.recent_activity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {(stats?.recent_activity || []).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="shrink-0 rounded-full bg-blue-100 p-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {
                          (
                            activity as unknown as {
                              candidate?: { full_name: string };
                            }
                          ).candidate?.full_name || "Unknown"
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getStatusLabel(activity.action)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(activity.created_at)}
                    </span>
                  </div>
                ))}
                {(!stats?.recent_activity ||
                  stats.recent_activity.length === 0) && (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-sm text-muted-foreground">
                      {t("common.no_results")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active Jobs */}
          <Card className="rounded-xl shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <div className="rounded-lg bg-purple-50 p-1.5">
                  <Briefcase className="h-4 w-4 text-purple-600" />
                </div>
                {t("dashboard.top_jobs")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.top_jobs && stats.top_jobs.length > 0 ? (
                <div className="space-y-2">
                  {stats.top_jobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm group-hover:text-blue-600 transition-colors truncate">
                          {job.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {job.candidate_count} {t("jobs.candidates_count")}
                          </span>
                        </div>
                      </div>
                      {job.top_score != null && job.top_score > 0 && (
                        <ScoreBadge score={job.top_score} size="sm" />
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground">
                    {t("common.no_results")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
