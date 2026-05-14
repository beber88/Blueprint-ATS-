import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moveContract } from "@/lib/contracts/queries";

export const dynamic = "force-dynamic";

// POST /api/contracts/contracts/:id/move  { folder_id: string | null }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();
  try {
    const body = await request.json();
    const folderId = body.folder_id ?? null;
    await moveContract(supabase, id, folderId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
