import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Total candidates
    const { count: totalCandidates } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true });

    // New this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const { count: newThisWeek } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneWeekAgo.toISOString());

    // Interviews scheduled (future)
    const { count: interviewsScheduled } = await supabase
      .from("interviews")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_at", new Date().toISOString());

    // Approved this month
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const { count: approvedThisMonth } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("updated_at", oneMonthAgo.toISOString());

    // Pipeline by status
    const { data: allCandidates } = await supabase
      .from("candidates")
      .select("status");

    const statusCounts: Record<string, number> = {};
    (allCandidates || []).forEach((c: { status: string }) => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });
    const pipelineByStatus = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    // Top jobs
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title, applications(ai_score)")
      .eq("status", "active")
      .limit(5);

    const topJobs = (jobs || []).map((job) => ({
      id: job.id,
      title: job.title,
      candidate_count: job.applications?.length || 0,
      top_score: job.applications?.length
        ? Math.max(...job.applications.map((a: { ai_score: number | null }) => a.ai_score || 0))
        : 0,
    }));

    // Recent activity
    const { data: recentActivity } = await supabase
      .from("activity_log")
      .select("*, candidate:candidates(full_name)")
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      total_candidates: totalCandidates || 0,
      new_this_week: newThisWeek || 0,
      interviews_scheduled: interviewsScheduled || 0,
      approved_this_month: approvedThisMonth || 0,
      pipeline_by_status: pipelineByStatus,
      top_jobs: topJobs,
      recent_activity: recentActivity || [],
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
