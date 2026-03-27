import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("jobs")
      .select(`*, applications(id, ai_score, status)`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }

    const jobs = (data || []).map((job) => {
      const apps = job.applications || [];
      const statusCounts: Record<string, number> = {};
      apps.forEach((a: { status: string }) => {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      });
      return {
        ...job,
        candidate_count: apps.length,
        top_score: apps.length
          ? Math.max(...apps.map((a: { ai_score: number | null }) => a.ai_score ?? 0))
          : null,
        status_breakdown: statusCounts,
      };
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        title: body.title,
        department: body.department || null,
        description: body.description || null,
        requirements: body.requirements || null,
        location: body.location || null,
        employment_type: body.employment_type || "full-time",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
