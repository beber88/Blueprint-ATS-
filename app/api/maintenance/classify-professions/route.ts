import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const supabase = createAdminClient();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, full_name, cv_raw_text, skills, experience_years, education")
      .is("profession", null)
      .not("cv_raw_text", "is", null)
      .limit(50);

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ classified: 0, message: "No candidates to classify" });
    }

    let classified = 0;
    let failed = 0;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      try {
        const text = (c.cv_raw_text || "").substring(0, 3000);
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `Based on this CV text, determine the candidate's primary profession for a construction company.
Return ONLY valid JSON:
{"profession":"one of: architect_licensed, architect, architect_intern, draftsman, project_manager, site_engineer, engineer_civil, engineer_structural, engineer_mep, engineer_electrical, engineer_mechanical, quantity_surveyor, finance, finance_accountant, hr, secretary, procurement, marketing, foreman, construction_worker, qc_inspector, hse_officer, document_controller, other","confidence":0.85,"reasoning":"brief explanation"}

CV: ${text}`
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
          classified++;
          console.log(`Classified: ${c.full_name} → ${parsed.profession} (${parsed.confidence})`);
        }
      } catch (err) {
        failed++;
        console.error(`Failed to classify ${c.full_name}:`, err instanceof Error ? err.message : err);
      }

      // Rate limit: pause every 5 candidates
      if (i > 0 && i % 5 === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return NextResponse.json({ classified, failed, total: candidates.length });
  } catch (error) {
    console.error("Classify error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
