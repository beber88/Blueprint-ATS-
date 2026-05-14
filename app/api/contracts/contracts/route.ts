import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listContracts } from "@/lib/contracts/queries";

export const dynamic = "force-dynamic";

// GET /api/contracts/contracts?category=&status=&project_id=&expiring_within_days=&limit=
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  try {
    const rawFolder = url.searchParams.get("folder_id");
    const data = await listContracts(supabase, {
      category: url.searchParams.get("category") || undefined,
      status: url.searchParams.get("status") || undefined,
      project_id: url.searchParams.get("project_id") || undefined,
      folder_id: rawFolder === "root" ? null : rawFolder || undefined,
      expiring_within_days: url.searchParams.get("expiring_within_days")
        ? parseInt(url.searchParams.get("expiring_within_days")!, 10)
        : undefined,
      limit: url.searchParams.get("limit")
        ? parseInt(url.searchParams.get("limit")!, 10)
        : undefined,
    });
    return NextResponse.json({ contracts: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
