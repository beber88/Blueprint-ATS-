import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getFolderBreadcrumbs,
  updateFolder,
  deleteFolder,
  moveFolder,
} from "@/lib/contracts/queries";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

// GET /api/contracts/folders/:id — single folder + breadcrumbs
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  const { id } = await params;
  const supabase = createAdminClient();
  try {
    const [folderRes, breadcrumbs] = await Promise.all([
      supabase.from("ct_folders").select("*").eq("id", id).single(),
      getFolderBreadcrumbs(supabase, id),
    ]);
    if (folderRes.error) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    return NextResponse.json({ folder: folderRes.data, breadcrumbs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// PATCH /api/contracts/folders/:id  { name?, parent_id?, color? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  const { id } = await params;
  const supabase = createAdminClient();
  try {
    const body = await request.json();

    // If moving to a new parent, use the safe moveFolder helper
    if (body.parent_id !== undefined) {
      await moveFolder(supabase, id, body.parent_id);
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.color !== undefined) updates.color = body.color;

    if (Object.keys(updates).length > 0) {
      await updateFolder(supabase, id, updates);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("circular") || msg.includes("descendant") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// DELETE /api/contracts/folders/:id — cascades subfolders, nullifies contract folder_id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireApiAuth({ module: "contracts" });
  if (authError) return authError;

  const { id } = await params;
  const supabase = createAdminClient();
  try {
    await deleteFolder(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
