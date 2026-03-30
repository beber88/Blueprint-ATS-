import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: candidates, error } = await supabase
      .from("candidates")
      .select("id, full_name, email, phone, profession, status, experience_years, skills, certifications, education, has_portfolio, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by profession
    const profMap: Record<string, {
      key: string; count: number; totalExp: number;
      statusBreakdown: Record<string, number>;
      topSkills: Record<string, number>;
      withPortfolio: number;
      certifications: Set<string>;
      candidates: { id: string; name: string; email: string | null; phone: string | null; experience: number; status: string; hasPortfolio: boolean; createdAt: string }[];
    }> = {};

    (candidates || []).forEach(c => {
      const prof = c.profession || "unclassified";
      if (!profMap[prof]) {
        profMap[prof] = {
          key: prof, count: 0, totalExp: 0,
          statusBreakdown: {}, topSkills: {}, withPortfolio: 0,
          certifications: new Set(), candidates: [],
        };
      }
      const g = profMap[prof];
      g.count++;
      g.totalExp += (c.experience_years || 0);
      g.statusBreakdown[c.status || "new"] = (g.statusBreakdown[c.status || "new"] || 0) + 1;
      if (c.has_portfolio) g.withPortfolio++;
      (c.skills || []).forEach((s: string) => { g.topSkills[s] = (g.topSkills[s] || 0) + 1; });
      (c.certifications || []).forEach((cert: string) => { g.certifications.add(cert); });
      g.candidates.push({
        id: c.id, name: c.full_name, email: c.email, phone: c.phone,
        experience: c.experience_years || 0, status: c.status || "new",
        hasPortfolio: c.has_portfolio || false, createdAt: c.created_at,
      });
    });

    const result = Object.values(profMap).map(p => ({
      key: p.key, count: p.count,
      avgExperience: p.count > 0 ? Math.round(p.totalExp / p.count) : 0,
      statusBreakdown: p.statusBreakdown,
      withPortfolio: p.withPortfolio,
      topSkills: Object.entries(p.topSkills)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([skill, count]) => ({ skill, count })),
      certifications: Array.from(p.certifications),
      candidates: p.candidates.sort((a, b) => b.experience - a.experience),
    }));

    result.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      professions: result,
      totalCandidates: candidates?.length || 0,
      totalProfessions: result.filter(r => r.key !== "unclassified").length,
    });
  } catch (error) {
    console.error("Professions analysis error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
