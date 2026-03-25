import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        *,
        applications(id, ai_score)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }

    const jobs = (data || []).map((job) => ({
      ...job,
      candidate_count: job.applications?.length || 0,
      top_score: job.applications?.length
        ? Math.max(...job.applications.map((a: { ai_score: number | null }) => a.ai_score || 0))
        : 0,
    }));

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
