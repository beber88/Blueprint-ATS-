import { createAdminClient } from "@/lib/supabase/admin";
import { similarityScore, normalizePhone } from "@/lib/utils";

export interface MatchResult {
  employee_id: string | null;
  confidence: number;
  method: "exact_phone" | "exact_name" | "fuzzy_name" | "none";
}

export async function matchEmployeeByPhone(
  supabase: ReturnType<typeof createAdminClient>,
  phone: string | null
): Promise<MatchResult> {
  const normalized = normalizePhone(phone);
  if (!normalized) return { employee_id: null, confidence: 0, method: "none" };

  const { data } = await supabase
    .from("op_employees")
    .select("id, whatsapp_phone, phone")
    .or(`whatsapp_phone.eq.${normalized},phone.eq.${normalized}`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (data) {
    return { employee_id: data.id, confidence: 1, method: "exact_phone" };
  }
  return { employee_id: null, confidence: 0, method: "none" };
}

export async function matchEmployeeByName(
  supabase: ReturnType<typeof createAdminClient>,
  rawName: string | null
): Promise<MatchResult> {
  if (!rawName || rawName.trim().length < 2) {
    return { employee_id: null, confidence: 0, method: "none" };
  }
  const cleaned = rawName.trim();
  const firstWord = cleaned.split(/\s+/)[0];

  const { data: exact } = await supabase
    .from("op_employees")
    .select("id, full_name")
    .eq("full_name", cleaned)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (exact) return { employee_id: exact.id, confidence: 1, method: "exact_name" };

  const { data: candidates } = await supabase
    .from("op_employees")
    .select("id, full_name")
    .ilike("full_name", `%${firstWord}%`)
    .eq("is_active", true)
    .limit(15);

  let best: { id: string; score: number } | null = null;
  for (const c of candidates || []) {
    const score = similarityScore(c.full_name, cleaned);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  if (best && best.score >= 0.7) {
    return { employee_id: best.id, confidence: Number(best.score.toFixed(3)), method: "fuzzy_name" };
  }
  return { employee_id: null, confidence: 0, method: "none" };
}

export async function matchDepartmentByName(
  supabase: ReturnType<typeof createAdminClient>,
  rawName: string | null
): Promise<string | null> {
  if (!rawName) return null;
  const cleaned = rawName.trim();
  if (!cleaned) return null;
  const { data } = await supabase
    .from("op_departments")
    .select("id, name, name_he, name_en, name_tl, code")
    .or(
      `name.ilike.%${cleaned}%,name_he.ilike.%${cleaned}%,name_en.ilike.%${cleaned}%,name_tl.ilike.%${cleaned}%,code.eq.${cleaned.toLowerCase()}`
    )
    .limit(5);
  if (!data || data.length === 0) return null;
  let best: { id: string; score: number } | null = null;
  for (const d of data) {
    for (const candidate of [d.name, d.name_he, d.name_en, d.name_tl, d.code].filter(Boolean) as string[]) {
      const score = similarityScore(candidate, cleaned);
      if (!best || score > best.score) best = { id: d.id, score };
    }
  }
  return best && best.score >= 0.6 ? best.id : null;
}

export async function matchProjectByName(
  supabase: ReturnType<typeof createAdminClient>,
  rawName: string | null
): Promise<string | null> {
  if (!rawName) return null;
  const cleaned = rawName.trim();
  if (!cleaned) return null;
  const { data } = await supabase
    .from("op_projects")
    .select("id, name, code")
    .or(`name.ilike.%${cleaned}%,code.eq.${cleaned}`)
    .limit(10);
  if (!data || data.length === 0) return null;
  let best: { id: string; score: number } | null = null;
  for (const p of data) {
    for (const candidate of [p.name, p.code].filter(Boolean) as string[]) {
      const score = similarityScore(candidate, cleaned);
      if (!best || score > best.score) best = { id: p.id, score };
    }
  }
  return best && best.score >= 0.6 ? best.id : null;
}
