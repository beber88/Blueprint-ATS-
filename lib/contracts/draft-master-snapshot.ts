import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContractSnapshot } from "./types";

// Loads the master-data lists used by computeContractWarnings. Kept here
// (server-only) so the warning logic itself stays pure and testable
// without a DB.
//
// "knownCounterparties" is the distinct list of recent counterparty_name
// values across ct_contracts. Cap at the most recent 500 — keeps the
// fuzzy-match haystack reasonable and avoids false positives from very
// old typos drifting into the set.
export async function loadContractSnapshot(
  supabase: SupabaseClient
): Promise<ContractSnapshot> {
  const [{ data: projects }, { data: contracts }] = await Promise.all([
    supabase
      .from("op_projects")
      .select("id, name")
      .eq("status", "active"),
    supabase
      .from("ct_contracts")
      .select("counterparty_name")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  // De-dupe counterparty names case-insensitively, preserving the first
  // (most recent) spelling we saw.
  const seen = new Set<string>();
  const knownCounterparties: Array<{ name: string }> = [];
  for (const row of contracts || []) {
    const name = (row as { counterparty_name?: string }).counterparty_name;
    if (!name) continue;
    const key = name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    knownCounterparties.push({ name });
  }

  return {
    activeProjects: (projects || []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
    })),
    knownCounterparties,
  };
}
