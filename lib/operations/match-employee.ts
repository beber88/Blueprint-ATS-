import { createAdminClient } from "@/lib/supabase/admin";
import { similarityScore, normalizePhone } from "@/lib/utils";
import { canonicalize, tokens } from "@/lib/shared/text-match";

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

  // Tier 1: exact code match (case-insensitive)
  const { data: byCode } = await supabase
    .from("op_projects")
    .select("id")
    .ilike("code", cleaned)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (byCode) return byCode.id;

  // Tier 2: exact name match (case-insensitive)
  const { data: byName } = await supabase
    .from("op_projects")
    .select("id")
    .ilike("name", cleaned)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (byName) return byName.id;

  // Tier 3+4: token-set matching + substring matching on all active projects
  // This catches word-reordering ("Pearl de Flore Phase 2" matches "Pearl de Flore"),
  // partial names, and alternate forms without needing an ilike hit.
  const { data: allProjects } = await supabase
    .from("op_projects")
    .select("id, name, code")
    .eq("status", "active");

  if (allProjects && allProjects.length > 0) {
    const inputTokens = tokens(cleaned);
    const inputCanon = canonicalize(cleaned);

    // Tier 3: token-set matching (word-order invariant)
    for (const p of allProjects) {
      for (const candidate of [p.name, p.code].filter(Boolean) as string[]) {
        const cTokens = tokens(candidate);
        if (inputTokens.size > 0 && cTokens.size > 0) {
          const [small, big] =
            inputTokens.size <= cTokens.size
              ? [inputTokens, cTokens]
              : [cTokens, inputTokens];
          let allIn = true;
          small.forEach((tok) => {
            if (!big.has(tok)) allIn = false;
          });
          if (allIn) return p.id;
        }
      }
    }

    // Tier 4: substring match on canonicalized form
    for (const p of allProjects) {
      for (const candidate of [p.name, p.code].filter(Boolean) as string[]) {
        const cCanon = canonicalize(candidate);
        if (
          cCanon === inputCanon ||
          cCanon.includes(inputCanon) ||
          inputCanon.includes(cCanon)
        ) {
          return p.id;
        }
      }
    }

    // Tier 5: fuzzy similarity (safety net for typos/transliterations)
    let best: { id: string; score: number } | null = null;
    for (const p of allProjects) {
      for (const candidate of [p.name, p.code].filter(Boolean) as string[]) {
        const score = similarityScore(candidate, cleaned);
        if (!best || score > best.score) best = { id: p.id, score };
      }
    }
    if (best && best.score >= 0.6) return best.id;
  }

  return null;
}
