"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoading } from "@/components/shared/loading";
import {
  Users, UserPlus, Calendar, CheckCircle, Upload, Briefcase, Plus, Activity,
} from "lucide-react";
import Link from "next/link";
import { DashboardStats } from "@/types";
import { formatDateTime, getStatusLabel } from "@/lib/utils";

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
      title: "Total Candidates",
      value: stats?.total_candidates || 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "New This Week",
      value: stats?.new_this_week || 0,
      icon: UserPlus,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Interviews Scheduled",
      value: stats?.interviews_scheduled || 0,
      icon: Calendar,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Approved This Month",
      value: stats?.approved_this_month || 0,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div>
      <Header title="Dashboard" subtitle="Overview of your hiring pipeline" />
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
              Upload CV
            </Button>
          </Link>
          <Link href="/jobs?new=true">
            <Button variant="outline">
              <Briefcase className="mr-2 h-4 w-4" />
              New Job
            </Button>
          </Link>
          <Link href="/interviews?new=true">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Schedule Interview
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pipeline by Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(stats?.pipeline_by_status || []).map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.count}</span>
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-electric-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (item.count / Math.max(stats?.total_candidates || 1, 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(!stats?.pipeline_by_status || stats.pipeline_by_status.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No candidates yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
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
                    No recent activity
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
              <CardTitle className="text-lg">Active Jobs</CardTitle>
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
                        {job.candidate_count} candidates
                      </p>
                    </div>
                    {job.top_score != null && job.top_score > 0 && (
                      <span className="text-sm font-medium text-green-600">
                        Top: {job.top_score}
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
