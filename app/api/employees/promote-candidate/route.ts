import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/employees/promote-candidate
 * Promote an existing candidate to a new employee record.
 * Body: { candidate_id, position?, department_id?, hire_date?, employment_status? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const candidateId = body.candidate_id;

    if (!candidateId) {
      return NextResponse.json({ error: "candidate_id is required" }, { status: 400 });
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("employees")
      .select("id")
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Candidate already promoted", employee_id: existing.id },
        { status: 409 }
      );
    }

    const { data: employee, error: insertError } = await supabase
      .from("employees")
      .insert({
        candidate_id: candidate.id,
        full_name: candidate.full_name,
        email: candidate.email,
        phone: candidate.phone,
        position: body.position || null,
        department_id: body.department_id || null,
        hire_date: body.hire_date || new Date().toISOString().split("T")[0],
        employment_status: body.employment_status || "active",
        source: "migrated_from_candidate",
        source_metadata: {
          candidate_id: candidate.id,
          promoted_at: new Date().toISOString(),
        },
        notes: candidate.notes,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Promote insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await supabase.from("employee_timeline").insert({
      employee_id: employee.id,
      event_type: "promoted_from_candidate",
      title: "Hired from candidate pipeline",
      description: `Candidate ${candidate.full_name} was promoted to employee`,
      related_table: "candidates",
      related_id: candidate.id,
      metadata: { previous_status: candidate.status },
    });

    await supabase
      .from("candidates")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", candidate.id);

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Promote candidate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
