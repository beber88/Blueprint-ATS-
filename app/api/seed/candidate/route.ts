import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCV } from "@/lib/claude/client";
import { similarityScore } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/seed/candidate
 *
 * Seed-only endpoint: accepts raw resume text (already extracted from PDF)
 * and creates a candidate via the same parseCV pipeline as /api/cv/upload.
 *
 * Body: { text: string, filename: string }
 */
export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  let body: { text: string; filename: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text, filename } = body;
  if (!text || text.trim().length < 50) {
    return NextResponse.json(
      { error: "Resume text too short (min 50 chars)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Parse with Claude
  let parsed;
  try {
    parsed = await parseCV(text);
  } catch (e) {
    return NextResponse.json(
      { error: `AI parsing failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  // Deduplication by email
  if (parsed.email) {
    const { data: existing } = await supabase
      .from("candidates")
      .select("id, full_name")
      .eq("email", parsed.email)
      .single();
    if (existing) {
      return NextResponse.json({
        duplicate: true,
        existing_id: existing.id,
        existing_name: existing.full_name,
      });
    }
  }

  // Deduplication by name similarity
  if (parsed.full_name && parsed.full_name !== "Unknown") {
    const firstName = parsed.full_name.split(" ")[0];
    if (firstName.length >= 2) {
      const { data: nameMatches } = await supabase
        .from("candidates")
        .select("id, full_name")
        .ilike("full_name", `%${firstName}%`)
        .limit(5);
      if (nameMatches) {
        for (const match of nameMatches) {
          if (similarityScore(match.full_name, parsed.full_name) > 0.85) {
            return NextResponse.json({
              duplicate: true,
              existing_id: match.id,
              existing_name: match.full_name,
            });
          }
        }
      }
    }
  }

  // Insert candidate
  const { data: candidate, error: dbError } = await supabase
    .from("candidates")
    .insert({
      full_name: parsed.full_name,
      email: parsed.email,
      phone: parsed.phone,
      location: parsed.location,
      cv_raw_text: text.slice(0, 100_000),
      skills: parsed.skills,
      experience_years: parsed.experience_years,
      education: parsed.education,
      certifications: parsed.certifications,
      previous_roles: parsed.previous_roles,
      source: "seed_import",
      status: "new",
      job_categories: parsed.job_categories || [],
      custom_category: parsed.custom_category || null,
      suggested_job:
        (parsed.job_categories || [])[0] ||
        parsed.suggested_job_category ||
        null,
      classification_confidence: parsed.suggested_job_confidence || null,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json(
      { error: `DB insert failed: ${dbError.message}` },
      { status: 500 }
    );
  }

  // Activity log
  await supabase.from("activity_log").insert({
    candidate_id: candidate.id,
    action: "cv_uploaded",
    details: {
      file_name: filename,
      source: "seed_import",
      classification: "cv",
    },
  });

  return NextResponse.json({
    candidateId: candidate.id,
    candidate: {
      full_name: candidate.full_name,
      email: candidate.email,
    },
  });
}
