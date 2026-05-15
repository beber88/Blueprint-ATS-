import { createAdminClient } from "@/lib/supabase/admin";

// Builds a compact context bundle the Contracts AI Agent uses for grounding.
// Mirrors the operations-context approach but scoped to contract data.

export async function buildContractsContext() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { data: contracts },
    { data: alerts },
    { data: drafts },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("ct_contracts")
      .select("id, title, counterparty_name, category, status, signing_date, effective_date, expiration_date, renewal_date, monetary_value, currency, is_renewable, flagged_for_review, project_id, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("ct_alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(100),
    supabase.from("ct_contract_drafts").select("id, status, source_kind, created_at").in("status", ["draft", "flagged"]).order("created_at", { ascending: false }).limit(50),
    supabase.from("op_projects").select("id, name").eq("status", "active"),
  ]);

  const rows = contracts || [];
  const active = rows.filter((c) => c.status === "active");
  const expiringSoon = active.filter((c) => c.expiration_date && c.expiration_date >= today && c.expiration_date <= thirtyDaysFromNow);
  const expired = rows.filter((c) => c.status === "expired" || (c.expiration_date && c.expiration_date < today && c.status === "active"));
  const flagged = rows.filter((c) => c.flagged_for_review);

  const byCategory: Record<string, number> = {};
  for (const c of active) byCategory[c.category] = (byCategory[c.category] || 0) + 1;

  const totalValue = active.reduce((sum, c) => sum + (c.monetary_value || 0), 0);

  const projectMap = new Map((projects || []).map((p) => [p.id, p.name]));

  const lines: string[] = [];
  lines.push(`CONTRACTS SNAPSHOT (as of ${new Date().toISOString()})`);
  lines.push(`- Active contracts: ${active.length}  Expiring (30d): ${expiringSoon.length}  Expired: ${expired.length}  Flagged: ${flagged.length}`);
  lines.push(`- Pending drafts: ${(drafts || []).length}`);
  lines.push(`- Open alerts: ${(alerts || []).length}`);
  lines.push(`- Total active value: ${totalValue.toLocaleString()}`);
  lines.push(`- By category: ${Object.entries(byCategory).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  lines.push("");

  if (expiringSoon.length > 0) {
    lines.push("EXPIRING WITHIN 30 DAYS:");
    for (const c of expiringSoon) {
      lines.push(`- "${c.title}" with ${c.counterparty_name} — expires ${c.expiration_date} (${c.category}, ${c.monetary_value ? `${c.monetary_value} ${c.currency}` : "no value"})${c.is_renewable ? " [renewable]" : ""}`);
    }
    lines.push("");
  }

  if (flagged.length > 0) {
    lines.push("FLAGGED FOR REVIEW:");
    for (const c of flagged) {
      lines.push(`- "${c.title}" with ${c.counterparty_name} — ${c.status} (${c.category})`);
    }
    lines.push("");
  }

  if ((alerts || []).length > 0) {
    lines.push("OPEN ALERTS:");
    for (const a of (alerts || []).slice(0, 30)) {
      lines.push(`- [${a.type} / ${a.severity}] ${a.message}`);
    }
    lines.push("");
  }

  lines.push(`ALL CONTRACTS (${rows.length}):`);
  for (const c of rows.slice(0, 200)) {
    const proj = c.project_id ? projectMap.get(c.project_id) || "" : "";
    const value = c.monetary_value ? `${c.monetary_value} ${c.currency || ""}` : "—";
    const dates = [
      c.signing_date ? `signed ${c.signing_date}` : "",
      c.effective_date ? `effective ${c.effective_date}` : "",
      c.expiration_date ? `expires ${c.expiration_date}` : "",
    ].filter(Boolean).join(", ");
    const flags = [
      c.flagged_for_review ? "FLAGGED" : "",
      c.is_renewable ? "RENEWABLE" : "",
      c.expiration_date && c.expiration_date < today && c.status === "active" ? "OVERDUE" : "",
    ].filter(Boolean).join(" ");
    lines.push(`- [${c.category}/${c.status}] "${c.title}" — ${c.counterparty_name} | ${value} | ${dates}${proj ? ` | project: ${proj}` : ""} ${flags}`);
    if (c.summary) lines.push(`    summary: ${c.summary.slice(0, 150)}`);
  }

  return {
    text: lines.join("\n"),
    counts: {
      active: active.length,
      expiring: expiringSoon.length,
      expired: expired.length,
      flagged: flagged.length,
      alerts: (alerts || []).length,
      drafts: (drafts || []).length,
    },
  };
}
