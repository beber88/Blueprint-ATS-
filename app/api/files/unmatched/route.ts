import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error: authError } = await requireApiAuth({ module: "recruitment" });
    if (authError) return authError;

    const supabase = createAdminClient();

    const { data: files, error } = await supabase
      .from("candidate_files")
      .select("*")
      .is("candidate_id", null)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get all candidates for matching suggestions
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, full_name, email, profession")
      .order("full_name");

    // For each file, find potential candidate matches
    const enrichedFiles = (files || []).map(file => {
      const meta = file.metadata as Record<string, string> | null;
      const detectedName = meta?.detected_person_name ||
        file.file_name?.replace(/\.(pdf|docx?)$/i, "")
          .replace(/[_-]+/g, " ")
          .replace(/\b(resume|cv|curriculum|vitae|portfolio|\d{4})\b/gi, "")
          .trim() || null;

      const suggestions = (candidates || []).filter(c => {
        if (!detectedName || detectedName.length < 2) return false;
        const nameParts = detectedName.toLowerCase().split(" ").filter((p: string) => p.length > 2);
        const candidateName = c.full_name.toLowerCase();
        return nameParts.some((part: string) => candidateName.includes(part));
      }).slice(0, 5);

      return { ...file, detected_name: detectedName, suggestions };
    });

    return NextResponse.json({
      files: enrichedFiles,
      total: enrichedFiles.length,
      candidates: candidates || [],
    });
  } catch (error) {
    console.error("Unmatched files API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
