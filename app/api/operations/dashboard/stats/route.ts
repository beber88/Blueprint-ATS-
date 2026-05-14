import { NextResponse } from "next/server";
import { getOperationsStats } from "@/lib/operations/queries";

export const dynamic = "force-dynamic";

export async function GET() {
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
