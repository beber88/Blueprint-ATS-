import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/contracts/alerts
 *
 * Returns:
 *  - existing ct_alerts rows (unresolved first)
 *  - synthesized "expiring_soon" pseudo-alerts for any active contract
 *    expiring in the next 60 days that doesn't already have an alert
 *  - synthesized "renewal_due" for renewal_date in next 30 days
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    const { data: alerts } = await admin
      .from("ct_alerts")
      .select("id, contract_id, type, severity, message, resolved_at, created_at")
      .order("resolved_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false });

    const today = new Date();
    const sixty = new Date();
    sixty.setDate(today.getDate() + 60);
    const thirty = new Date();
    thirty.setDate(today.getDate() + 30);

    const { data: contracts } = await admin
      .from("ct_contracts")
      .select(
        "id, title, counterparty_name, status, expiration_date, renewal_date, is_renewable"
      )
      .eq("status", "active")
      .or(
        `expiration_date.lte.${sixty.toISOString().slice(0, 10)},renewal_date.lte.${thirty.toISOString().slice(0, 10)}`
      );

    const synthesized: Array<{
      pseudo_id: string;
      contract_id: string;
      contract_title: string;
      counterparty: string;
      type: string;
      severity: string;
      message: string;
      due_date: string;
    }> = [];

    (contracts || []).forEach((c) => {
      if (c.expiration_date) {
        const exp = new Date(c.expiration_date);
        const daysLeft = Math.round((exp.getTime() - today.getTime()) / 86400000);
        if (daysLeft <= 60 && daysLeft >= -7) {
          synthesized.push({
            pseudo_id: `exp-${c.id}`,
            contract_id: c.id,
            contract_title: c.title,
            counterparty: c.counterparty_name,
            type: daysLeft < 0 ? "expired" : "expiring_soon",
            severity: daysLeft < 7 ? "high" : daysLeft < 30 ? "medium" : "low",
            message: daysLeft < 0
              ? `Expired ${-daysLeft}d ago`
              : `Expires in ${daysLeft}d`,
            due_date: c.expiration_date,
          });
        }
      }
      if (c.renewal_date) {
        const ren = new Date(c.renewal_date);
        const daysLeft = Math.round((ren.getTime() - today.getTime()) / 86400000);
        if (daysLeft <= 30 && daysLeft >= 0) {
          synthesized.push({
            pseudo_id: `ren-${c.id}`,
            contract_id: c.id,
            contract_title: c.title,
            counterparty: c.counterparty_name,
            type: "renewal_due",
            severity: daysLeft < 7 ? "high" : "medium",
            message: `Renewal decision due in ${daysLeft}d`,
            due_date: c.renewal_date,
          });
        }
      }
    });

    return NextResponse.json({
      stored: alerts || [],
      synthesized,
    });
  } catch (err) {
    console.error("Contracts alerts error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
