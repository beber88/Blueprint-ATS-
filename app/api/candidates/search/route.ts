import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const supabase = createAdminClient();
    const body = await request.json();
    console.log("Search API called with:", JSON.stringify({ search: body.search, statuses: body.statuses, professions: body.professions, preset: body.preset, per_page: body.per_page }));
    const {
      search = "",
      statuses = [],
      professions = [],
      min_experience,
      max_experience,
      min_score,
      max_score,
      has_portfolio,
      has_email,
      has_phone,
      required_skills = [],
      uploaded_after,
      uploaded_before,
      sort_by = "created_at",
      sort_order = "desc",
      page = 1,
      per_page = 50,
      preset,
    } = body;

    let query = supabase
      .from("candidates")
      .select(
        "*, applications(id, ai_score, status, job:jobs(title))",
        { count: "exact" }
      );

    // Presets
    if (preset === "new_this_week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte("created_at", weekAgo.toISOString());
    }
    if (preset === "ready_for_interview") {
      query = query.in("status", ["shortlisted", "reviewed"]);
    }
    if (preset === "strong_candidates") {
      query = query.gte("overall_ai_score", 75);
    }
    if (preset === "with_portfolio") {
      query = query.eq("has_portfolio", true);
    }
    if (preset === "uncontacted") {
      query = query
        .is("last_contacted_at", null)
        .not("email", "is", null);
    }

    // Text search
    if (search.trim()) {
      query = query.or(
        `full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`
      );
    }

    // Filters
    if (statuses.length > 0) query = query.in("status", statuses);
    if (professions.length > 0) query = query.in("profession", professions);
    if (min_experience != null)
      query = query.gte("experience_years", min_experience);
    if (max_experience != null)
      query = query.lte("experience_years", max_experience);
    if (min_score != null) query = query.gte("overall_ai_score", min_score);
    if (max_score != null) query = query.lte("overall_ai_score", max_score);
    if (has_portfolio === true) query = query.eq("has_portfolio", true);
    if (has_email === true) query = query.not("email", "is", null);
    if (has_phone === true) query = query.not("phone", "is", null);
    if (required_skills.length > 0)
      query = query.contains("skills", required_skills);
    if (uploaded_after) query = query.gte("created_at", uploaded_after);
    if (uploaded_before) query = query.lte("created_at", uploaded_before);

    // Sort
    const validSorts = [
      "created_at",
      "full_name",
      "experience_years",
      "overall_ai_score",
      "profession",
      "status",
    ];
    const sortField = validSorts.includes(sort_by) ? sort_by : "created_at";
    query = query.order(sortField, { ascending: sort_order === "asc", nullsFirst: false });

    // Pagination
    const from = (page - 1) * per_page;
    query = query.range(from, from + per_page - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      candidates: data || [],
      total: count || 0,
      page,
      per_page,
      total_pages: Math.ceil((count || 0) / per_page),
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
