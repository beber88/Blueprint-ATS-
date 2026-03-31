import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

    // Run all queries in parallel
    const [
      { count: totalCandidates },
      { count: newThisWeek },
      { count: interviewsScheduled },
      { count: approvedThisMonth },
      { data: allCandidates },
      { data: jobs },
      { data: recentActivity },
      { count: totalJobs },
      { count: activeJobs },
      { count: messagesSentMonth },
      { count: unmatchedFiles },
    ] = await Promise.all([
      supabase.from("candidates").select("*", { count: "exact", head: true }),
      supabase.from("candidates").select("*", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
      supabase.from("interviews").select("*", { count: "exact", head: true }).gte("scheduled_at", now.toISOString()),
      supabase.from("candidates").select("*", { count: "exact", head: true }).eq("status", "approved").gte("updated_at", monthAgo.toISOString()),
      supabase.from("candidates").select("id, full_name, email, status, profession, experience_years, overall_ai_score, has_portfolio, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("jobs").select("id, title, status, applications(ai_score)").order("created_at", { ascending: false }),
      supabase.from("activity_log").select("*, candidate:candidates(full_name)").order("created_at", { ascending: false }).limit(20),
      supabase.from("jobs").select("*", { count: "exact", head: true }),
      supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("messages_sent").select("*", { count: "exact", head: true }).gte("created_at", monthAgo.toISOString()),
      supabase.from("candidate_files").select("*", { count: "exact", head: true }).is("candidate_id", null),
    ]);

    const candidates = allCandidates || [];

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    candidates.forEach(c => { statusCounts[c.status || "new"] = (statusCounts[c.status || "new"] || 0) + 1; });

    // Profession breakdown
    const professionCounts: Record<string, number> = {};
    candidates.forEach(c => { if (c.profession) professionCounts[c.profession] = (professionCounts[c.profession] || 0) + 1; });

    // Experience distribution
    const expDist = { "0-2": 0, "3-5": 0, "6-10": 0, "11-20": 0, "20+": 0 };
    candidates.forEach(c => {
      const y = c.experience_years || 0;
      if (y <= 2) expDist["0-2"]++;
      else if (y <= 5) expDist["3-5"]++;
      else if (y <= 10) expDist["6-10"]++;
      else if (y <= 20) expDist["11-20"]++;
      else expDist["20+"]++;
    });

    // Score distribution
    const scoreDist = { "0-39": 0, "40-69": 0, "70-84": 0, "85-100": 0 };
    let scoreSum = 0; let scoreCount = 0;
    candidates.forEach(c => {
      const s = c.overall_ai_score;
      if (s != null) {
        scoreCount++; scoreSum += s;
        if (s < 40) scoreDist["0-39"]++;
        else if (s < 70) scoreDist["40-69"]++;
        else if (s < 85) scoreDist["70-84"]++;
        else scoreDist["85-100"]++;
      }
    });

    // Monthly timeline (last 6 months)
    const timeline: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const count = candidates.filter(c => c.created_at?.startsWith(monthKey)).length;
      timeline.push({ month: monthKey, count });
    }

    // Top jobs
    const topJobs = (jobs || []).filter((j: { status: string }) => j.status === "active").slice(0, 5).map((job: { id: string; title: string; applications?: { ai_score: number | null }[] }) => ({
      id: job.id, title: job.title,
      candidate_count: job.applications?.length || 0,
      top_score: job.applications?.length ? Math.max(...job.applications.map(a => a.ai_score ?? 0)) : null,
    }));

    // Recent candidates (last 10)
    const recentCandidates = candidates.slice(0, 10).map(c => ({
      id: c.id, full_name: c.full_name, email: c.email, status: c.status,
      profession: c.profession, experience_years: c.experience_years,
      overall_ai_score: c.overall_ai_score, created_at: c.created_at,
    }));

    return NextResponse.json({
      cards: {
        total_candidates: totalCandidates || 0,
        new_this_week: newThisWeek || 0,
        interviews_scheduled: interviewsScheduled || 0,
        approved_this_month: approvedThisMonth || 0,
        total_jobs: totalJobs || 0,
        active_jobs: activeJobs || 0,
        avg_ai_score: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
        messages_sent_month: messagesSentMonth || 0,
        unmatched_files: unmatchedFiles || 0,
        with_portfolio: candidates.filter(c => c.has_portfolio).length,
      },
      charts: {
        status_breakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        profession_breakdown: Object.entries(professionCounts).map(([profession, count]) => ({ profession, count })).sort((a, b) => b.count - a.count),
        experience_distribution: Object.entries(expDist).map(([range, count]) => ({ range, count })),
        score_distribution: Object.entries(scoreDist).map(([range, count]) => ({ range, count })),
        monthly_timeline: timeline,
      },
      top_jobs: topJobs,
      recent_candidates: recentCandidates,
      recent_activity: recentActivity || [],
      last_updated: now.toISOString(),
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
