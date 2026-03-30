import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is missing");
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const supabase = createAdminClient();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get ALL candidates without profession — don't filter by cv_raw_text
    const { data: candidates, error: fetchError } = await supabase
      .from("candidates")
      .select("id, full_name, cv_raw_text, skills, previous_roles, education, certifications, experience_years")
      .is("profession", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error("Failed to fetch candidates:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ success: true, classified: 0, failed: 0, total: 0, message: "No candidates need classification" });
    }

    console.log(`Starting classification for ${candidates.length} candidates`);

    let classified = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      try {
        // Build context from ALL available data
        let contextText = "";

        if (c.cv_raw_text && c.cv_raw_text.trim().length > 50) {
          contextText = c.cv_raw_text.substring(0, 3000);
        } else {
          // Build from structured fields
          const parts: string[] = [];
          if (c.full_name) parts.push(`Name: ${c.full_name}`);
          if (c.skills && (c.skills as string[]).length > 0) parts.push(`Skills: ${(c.skills as string[]).join(", ")}`);
          if (c.previous_roles && Array.isArray(c.previous_roles) && c.previous_roles.length > 0) {
            const roles = (c.previous_roles as { title?: string; company?: string; duration?: string }[])
              .map(r => `${r.title || ""} at ${r.company || ""} (${r.duration || ""})`)
              .join("; ");
            parts.push(`Previous roles: ${roles}`);
          }
          if (c.education) parts.push(`Education: ${c.education}`);
          if (c.certifications && (c.certifications as string[]).length > 0) parts.push(`Certifications: ${(c.certifications as string[]).join(", ")}`);
          if (c.experience_years) parts.push(`Experience: ${c.experience_years} years`);
          contextText = parts.join("\n");
        }

        if (contextText.trim().length < 10) {
          // Mark as "other" with low confidence
          await supabase.from("candidates").update({
            profession: "other", profession_confidence: 0.1, profession_source: "auto",
          }).eq("id", c.id);
          classified++;
          console.log(`Marked ${c.full_name} as 'other' (no data)`);
          continue;
        }

        console.log(`Classifying ${c.full_name} (${contextText.length} chars)...`);

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `Based on this candidate info, determine their primary profession in construction/engineering/architecture.
Return ONLY JSON (no markdown): {"profession":"one of: architect_licensed, architect, architect_intern, draftsman, project_manager, site_engineer, engineer_civil, engineer_structural, engineer_mep, engineer_electrical, engineer_mechanical, quantity_surveyor, finance, hr, secretary, procurement, marketing, foreman, construction_worker, qc_inspector, hse_officer, document_controller, other","confidence":0.85,"reasoning":"brief"}

Candidate: ${contextText}`
          }],
        });

        const content = response.content[0];
        if (content.type === "text") {
          const cleaned = content.text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
          const match = cleaned.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(match ? match[0] : cleaned);

          await supabase.from("candidates").update({
            profession: parsed.profession,
            profession_confidence: parsed.confidence || 0.85,
            profession_source: "auto",
          }).eq("id", c.id);

          await supabase.from("activity_log").insert({
            candidate_id: c.id, action: "profession_classified",
            details: { profession: parsed.profession, confidence: parsed.confidence, reasoning: parsed.reasoning, source: "auto_batch" },
          });

          classified++;
          console.log(`✓ ${c.full_name} → ${parsed.profession} (${parsed.confidence})`);
        }
      } catch (err) {
        failed++;
        errors.push(`${c.full_name}: ${err instanceof Error ? err.message : "error"}`);
        console.error(`✗ ${c.full_name}:`, err instanceof Error ? err.message : err);
      }

      // Rate limit: pause every 3 candidates
      if (i > 0 && i % 3 === 0) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`Classification done: ${classified} classified, ${failed} failed`);
    return NextResponse.json({ success: true, classified, failed, total: candidates.length, errors: errors.slice(0, 10) });
  } catch (error) {
    console.error("Classification batch error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
