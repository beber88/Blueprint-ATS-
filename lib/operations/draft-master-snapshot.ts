import type { SupabaseClient } from "@supabase/supabase-js";
import type { MasterDataSnapshot } from "./draft-warnings";

// Loads the master-data lists used by computeWarnings. Kept here (server-only)
// so the warning logic itself stays pure and testable without a DB.
export async function loadMasterSnapshot(
  supabase: SupabaseClient
): Promise<MasterDataSnapshot> {
  const [{ data: projects }, { data: employees }] = await Promise.all([
    supabase
      .from("op_projects")
      .select("id, name")
      .eq("status", "active"),
    supabase
      .from("op_employees")
      .select("id, full_name")
      .eq("is_active", true),
  ]);
  return {
    activeProjects: (projects || []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
    })),
    activeEmployees: (employees || []).map((e) => ({
      id: e.id as string,
      full_name: e.full_name as string,
    })),
  };
}
