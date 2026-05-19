import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;

  const supabase = createAdminClient();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = supabase
    .from("drive_files")
    .select("*, employee:op_employees(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("classification_status", status);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ files: data || [], total: count || 0 });
}
