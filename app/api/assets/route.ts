import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("hr_assets")
      .select(
        "id, asset_type, brand, model, serial_number, asset_tag, status, purchase_date, purchase_cost, notes, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      console.error("Assets query error:", error);
      return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
    }

    const { data: assignments } = await supabase
      .from("hr_asset_assignments")
      .select(
        "id, asset_id, employee_id, assigned_at, returned_at, employee:op_employees!employee_id(id, full_name)"
      )
      .is("returned_at", null);

    const assignmentByAsset = new Map<string, { id: string; full_name: string }>();
    (assignments || []).forEach((a) => {
      const emp = Array.isArray(a.employee) ? a.employee[0] : a.employee;
      if (a.asset_id && emp) {
        assignmentByAsset.set(a.asset_id, emp);
      }
    });

    const enriched = (data || []).map((asset) => ({
      ...asset,
      assigned_to: assignmentByAsset.get(asset.id) || null,
    }));

    return NextResponse.json({ assets: enriched });
  } catch (err) {
    console.error("Assets GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
