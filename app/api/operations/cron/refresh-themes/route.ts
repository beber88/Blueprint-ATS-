import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

function extractJSON<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch { /* noop */ }
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) try { return JSON.parse(m[1].trim()) as T; } catch { /* noop */ }
  const o = text.match(/\[[\s\S]*\]/);
  if (o) return JSON.parse(o[0]) as T;
  return [] as unknown as T;
}

interface ThemeOut {
  theme: string;
  occurrence_count: number;
  sample_issues: string[];
  project_name?: string | null;
  department_code?: string | null;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: items } = await supabase
    .from("op_report_items")
    .select("issue, project_id, department_id, project:op_projects(name), department:op_departments(code, name)")
    .gte("report_date", since)
    .neq("status", "resolved")
    .limit(800);

  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, themes_inserted: 0, note: "no items" });
  }

  // Send a compact list to Claude for clustering
  const corpus = items
    .map((r, i) => {
      const proj = (r.project as { name?: string } | null)?.name || "—";
      const dept = (r.department as { name?: string; code?: string } | null)?.name || "—";
      return `${i + 1}. [${dept} / ${proj}] ${r.issue.slice(0, 200)}`;
    })
    .join("\n");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system:
      "You cluster a list of operational issues from a construction company into recurring themes. Hebrew + English mixed input is normal. Return ONLY a JSON array. Each element: {theme: string short HE label, occurrence_count: number, sample_issues: string[] up to 3, project_name: string|null, department_code: string|null}. Only return themes with occurrence_count >= 2. Max 15 themes.",
    messages: [{ role: "user", content: `Cluster these issues:\n${corpus}\n\nReturn the JSON array now.` }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") return NextResponse.json({ error: "Bad AI response" }, { status: 500 });
  const themes = extractJSON<ThemeOut[]>(block.text);

  // Replace existing themes (truncate + insert)
  await supabase.from("op_recurring_themes").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  if (themes.length > 0) {
    const { data: projects } = await supabase.from("op_projects").select("id, name");
    const { data: departments } = await supabase.from("op_departments").select("id, code");
    const projByName = new Map((projects || []).map((p) => [p.name.toLowerCase(), p.id]));
    const deptByCode = new Map((departments || []).map((d) => [d.code, d.id]));

    const rows = themes
      .filter((t) => t && t.theme && (t.occurrence_count || 0) >= 2)
      .slice(0, 15)
      .map((t) => ({
        theme: String(t.theme).slice(0, 200),
        occurrence_count: Math.max(1, Math.floor(t.occurrence_count || 1)),
        sample_issues: Array.isArray(t.sample_issues) ? t.sample_issues.slice(0, 3) : [],
        project_id: t.project_name ? projByName.get(String(t.project_name).toLowerCase()) || null : null,
        department_id: t.department_code ? deptByCode.get(String(t.department_code).toLowerCase()) || null : null,
        last_seen_at: new Date().toISOString(),
      }));
    if (rows.length > 0) {
      await supabase.from("op_recurring_themes").insert(rows);
    }
    return NextResponse.json({ ok: true, themes_inserted: rows.length });
  }

  return NextResponse.json({ ok: true, themes_inserted: 0 });
}

export const POST = GET;
