import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeEmployerContributions,
  type StatutoryBreakdown,
} from "@/lib/payroll/compute";

export const dynamic = "force-dynamic";

interface PayslipRow {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  status: string;
  breakdown: {
    base_salary?: number;
    statutory?: StatutoryBreakdown;
  } | null;
  employee: { id: string; full_name: string; government_ids: Record<string, string> | null } | null;
}

/**
 * GET /api/government/remittance?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
 *
 * Aggregates statutory contributions from payslips whose period_start
 * falls inside the requested window into a filing-ready remittance
 * summary: employee + employer share per agency (SSS, PhilHealth,
 * Pag-IBIG) plus BIR withholding tax. Draft payslips are excluded —
 * only approved/paid payslips count toward a remittance.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("period_start");
    const periodEnd = searchParams.get("period_end");

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "period_start and period_end are required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hr_payslips")
      .select(
        "id, employee_id, period_start, period_end, status, breakdown, employee:op_employees!employee_id(id, full_name, government_ids)"
      )
      .gte("period_start", periodStart)
      .lte("period_start", periodEnd)
      .in("status", ["approved", "paid"])
      .order("period_start", { ascending: true });

    if (error) {
      console.error("Remittance query error:", error);
      return NextResponse.json({ error: "Failed to load payslips" }, { status: 500 });
    }

    const payslips = (data || []) as unknown as PayslipRow[];

    const rows = payslips.map((p) => {
      const stat = p.breakdown?.statutory;
      const base = p.breakdown?.base_salary || 0;
      const employer = computeEmployerContributions(base);
      const ids = p.employee?.government_ids || {};
      return {
        payslip_id: p.id,
        employee_id: p.employee_id,
        employee_name: p.employee?.full_name || "—",
        period_start: p.period_start,
        period_end: p.period_end,
        sss_no: ids.sss_no || null,
        philhealth_no: ids.philhealth_no || null,
        pagibig_no: ids.pagibig_no || null,
        tin: ids.tin || null,
        sss_ee: stat?.sss || 0,
        sss_er: employer.sss,
        philhealth_ee: stat?.philhealth || 0,
        philhealth_er: employer.philhealth,
        pagibig_ee: stat?.pagibig || 0,
        pagibig_er: employer.pagibig,
        withholding_tax: stat?.withholding_tax || 0,
      };
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const sum = (key: keyof (typeof rows)[number]) =>
      round2(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0));

    const totals = {
      sss_ee: sum("sss_ee"),
      sss_er: sum("sss_er"),
      sss_total: round2(sum("sss_ee") + sum("sss_er")),
      philhealth_ee: sum("philhealth_ee"),
      philhealth_er: sum("philhealth_er"),
      philhealth_total: round2(sum("philhealth_ee") + sum("philhealth_er")),
      pagibig_ee: sum("pagibig_ee"),
      pagibig_er: sum("pagibig_er"),
      pagibig_total: round2(sum("pagibig_ee") + sum("pagibig_er")),
      withholding_tax: sum("withholding_tax"),
      grand_total: round2(
        sum("sss_ee") +
          sum("sss_er") +
          sum("philhealth_ee") +
          sum("philhealth_er") +
          sum("pagibig_ee") +
          sum("pagibig_er") +
          sum("withholding_tax")
      ),
    };

    const missingIds = rows
      .filter((r) => !r.sss_no || !r.philhealth_no || !r.pagibig_no || !r.tin)
      .map((r) => r.employee_name);

    return NextResponse.json({
      period_start: periodStart,
      period_end: periodEnd,
      payslip_count: rows.length,
      rows,
      totals,
      warnings: missingIds.length
        ? [`${missingIds.length} employee(s) missing government IDs: ${missingIds.join(", ")}`]
        : [],
    });
  } catch (err) {
    console.error("Remittance error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
