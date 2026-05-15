import { NextResponse } from "next/server";
import { getOperationsStats } from "@/lib/operations/queries";
import { requireApiAuth } from "@/lib/api/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  try {
    const stats = await getOperationsStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load stats" },
      { status: 500 }
    );
  }
}
