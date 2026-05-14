import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily cron — scans ct_contracts for date-based alert conditions and
// emits unresolved ct_alerts rows.
//
// Schedule (vercel.json): "0 6 * * *" — daily 06:00 UTC = 09:00 IDT /
// 14:00 PHT. Don't change the timezone without updating
// docs/operations/production-readiness.md.
//
// Idempotency: ct_alerts has a partial unique index on
// (contract_id, type) WHERE resolved_at IS NULL. Re-running the cron
// won't create duplicate active alerts.

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev mode — no secret set
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 30;
const RENEWAL_WINDOW_DAYS = 60;

interface ContractRow {
  id: string;
  project_id: string | null;
  category: string;
  counterparty_name: string;
  title: string;
  expiration_date: string | null;
  renewal_date: string | null;
  is_renewable: boolean;
  status: string;
}

async function tryCreateAlert(
  supabase: ReturnType<typeof createAdminClient>,
  contract: ContractRow,
  type: "expiring_soon" | "expired" | "renewal_window_open",
  severity: "low" | "medium" | "high",
  message: string
): Promise<boolean> {
  // The partial unique index handles the dedupe at the DB level. Postgres
  // returns 23505 on conflict; we treat it as no-op (alert already exists
  // and is still unresolved).
  const { error } = await supabase.from("ct_alerts").insert({
    contract_id: contract.id,
    project_id: contract.project_id,
    type,
    severity,
    message,
  });
  if (error) {
    if (error.code === "23505") return false; // already exists, expected
    console.error("scan-deadlines: insert failed", error);
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const todayIso = isoDate(today);
  const in30 = isoDate(new Date(today.getTime() + EXPIRING_SOON_DAYS * DAY_MS));
  const in60 = isoDate(new Date(today.getTime() + RENEWAL_WINDOW_DAYS * DAY_MS));

  const { data: contracts, error } = await supabase
    .from("ct_contracts")
    .select(
      "id, project_id, category, counterparty_name, title, expiration_date, renewal_date, is_renewable, status"
    )
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let alertsCreated = 0;
  let statusUpdates = 0;

  for (const c of (contracts || []) as ContractRow[]) {
    // (1) Expired — also auto-flip status to 'expired'.
    if (c.expiration_date && c.expiration_date < todayIso) {
      const created = await tryCreateAlert(
        supabase,
        c,
        "expired",
        "high",
        `Contract "${c.title}" (${c.counterparty_name}) expired on ${c.expiration_date}.`
      );
      if (created) alertsCreated++;
      await supabase
        .from("ct_contracts")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", c.id);
      statusUpdates++;
      continue; // expired contracts skip the rest of the checks
    }

    // (2) Expiring within 30 days.
    if (
      c.expiration_date &&
      c.expiration_date >= todayIso &&
      c.expiration_date <= in30
    ) {
      const created = await tryCreateAlert(
        supabase,
        c,
        "expiring_soon",
        "medium",
        `Contract "${c.title}" (${c.counterparty_name}) expires on ${c.expiration_date}.`
      );
      if (created) alertsCreated++;
    }

    // (3) Renewal window open — renewable contracts whose renewal_date is
    // within 60 days.
    if (
      c.is_renewable &&
      c.renewal_date &&
      c.renewal_date >= todayIso &&
      c.renewal_date <= in60
    ) {
      const created = await tryCreateAlert(
        supabase,
        c,
        "renewal_window_open",
        "medium",
        `Renewal window open for "${c.title}" (${c.counterparty_name}) — renewal date ${c.renewal_date}.`
      );
      if (created) alertsCreated++;
    }
  }

  return NextResponse.json({
    scanned: (contracts || []).length,
    alertsCreated,
    statusUpdates,
  });
}
