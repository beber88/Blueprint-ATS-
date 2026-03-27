import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const jobId = searchParams.get("jobId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("candidates")
      .select("*, job:jobs(id, title), applications(id, job_id, ai_score, status, job:jobs(title))", { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,skills.cs.{${search}}`);
    }

    const contactStatus = searchParams.get("contactStatus");

    if (jobId) {
      query = query.or(`job_id.eq.${jobId},applications.job_id.eq.${jobId}`);
    }

    if (contactStatus) {
      query = query.eq("contact_status", contactStatus);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Query error:", error);
      return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
    }

    return NextResponse.json({ candidates: data, total: count, page, limit });
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
      .from("candidates")
      .insert({
        full_name: body.full_name,
        email: body.email || null,
        phone: body.phone || null,
        location: body.location || null,
        linkedin_url: body.linkedin_url || null,
        skills: body.skills || [],
        experience_years: body.experience_years || null,
        education: body.education || null,
        certifications: body.certifications || [],
        previous_roles: body.previous_roles || [],
        notes: body.notes || null,
        source: body.source || "manual",
        status: "new",
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Failed to create candidate" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      candidate_id: data.id,
      action: "candidate_created",
      details: { source: body.source || "manual" },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
