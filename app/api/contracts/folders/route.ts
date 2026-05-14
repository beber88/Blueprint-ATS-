import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listFolders,
  listContracts,
  getFolderBreadcrumbs,
  createFolder,
} from "@/lib/contracts/queries";

export const dynamic = "force-dynamic";

// GET /api/contracts/folders?parent_id=<uuid>&category=&status=
// parent_id omitted or "root" → root level (parent_id IS NULL)
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  const rawParent = url.searchParams.get("parent_id");
  const parentId = !rawParent || rawParent === "root" ? null : rawParent;

  try {
    const [folders, contracts, breadcrumbs] = await Promise.all([
      listFolders(supabase, parentId),
      listContracts(supabase, {
        folder_id: parentId,
        category: url.searchParams.get("category") || undefined,
        status: url.searchParams.get("status") || undefined,
      }),
      parentId ? getFolderBreadcrumbs(supabase, parentId) : Promise.resolve([]),
    ]);

    return NextResponse.json({ folders, contracts, breadcrumbs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// POST /api/contracts/folders  { name, parent_id?, color? }
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const folder = await createFolder(supabase, {
      name,
      parent_id: body.parent_id ?? null,
      color: body.color ?? null,
    });
    return NextResponse.json({ folder }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("duplicate") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
