import type { SupabaseClient } from "@supabase/supabase-js";

// Decides whether `userId` can read `employeeId`'s full profile.
//
// Rules (in order):
//   1. admin and hr roles → always true.
//   2. Anyone else → true only if they have an active row in
//      hr_profile_grants (revoked_at IS NULL, not expired).
//   3. Otherwise → false.
//
// The caller is expected to pass a service-role / admin client (we
// need to read user_profiles + hr_profile_grants without RLS getting
// in the way; the access decision IS the RLS decision).
export async function canAccessEmployeeProfile(
  supabase: SupabaseClient,
  userId: string,
  employeeId: string
): Promise<boolean> {
  if (!userId || !employeeId) return false;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role = (profile?.role as string | undefined) ?? null;
  if (role === "admin" || role === "hr") return true;

  const nowIso = new Date().toISOString();
  const { data: grant } = await supabase
    .from("hr_profile_grants")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("employee_id", employeeId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!grant) return false;
  if (grant.expires_at && grant.expires_at <= nowIso) return false;
  return true;
}

// Admin-only check — used by the grants-management endpoints.
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  if (!userId) return false;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return profile?.role === "admin";
}
