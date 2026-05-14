import type { SupabaseClient } from "@supabase/supabase-js";

// Read-side query helpers for the Contracts module. Used by the dashboard
// stats route, list pages, and detail page. Pure DB I/O, no business
// logic — keeps the API routes thin.

export interface ContractKpis {
  active: number;
  expiring30d: number;
  expired: number;
  flagged: number;
  openAlerts: number;
}

const DAY = 24 * 60 * 60 * 1000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getContractKpis(supabase: SupabaseClient): Promise<ContractKpis> {
  const today = isoDate(new Date());
  const in30 = isoDate(new Date(Date.now() + 30 * DAY));

  const [active, expiring, expired, flagged, alerts] = await Promise.all([
    supabase
      .from("ct_contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("ct_contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("expiration_date", today)
      .lte("expiration_date", in30),
    supabase
      .from("ct_contracts")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired"),
    supabase
      .from("ct_contracts")
      .select("id", { count: "exact", head: true })
      .eq("flagged_for_review", true),
    supabase
      .from("ct_alerts")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null),
  ]);

  return {
    active: active.count || 0,
    expiring30d: expiring.count || 0,
    expired: expired.count || 0,
    flagged: flagged.count || 0,
    openAlerts: alerts.count || 0,
  };
}

export async function listContracts(
  supabase: SupabaseClient,
  filters: {
    category?: string;
    status?: string;
    project_id?: string;
    expiring_within_days?: number;
    limit?: number;
  } = {}
) {
  let q = supabase
    .from("ct_contracts")
    .select(
      "id, category, counterparty_name, project_id, title, expiration_date, monetary_value, currency, status, flagged_for_review, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.category) q = q.eq("category", filters.category);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.project_id) q = q.eq("project_id", filters.project_id);
  if (filters.expiring_within_days) {
    const today = isoDate(new Date());
    const cutoff = isoDate(new Date(Date.now() + filters.expiring_within_days * DAY));
    q = q.gte("expiration_date", today).lte("expiration_date", cutoff);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listAlerts(
  supabase: SupabaseClient,
  filters: { resolved?: boolean; limit?: number } = {}
) {
  let q = supabase
    .from("ct_alerts")
    .select(
      "id, contract_id, project_id, type, severity, message, resolved_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.resolved === false) q = q.is("resolved_at", null);
  else if (filters.resolved === true) q = q.not("resolved_at", "is", null);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
