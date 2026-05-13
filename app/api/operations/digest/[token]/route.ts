import { NextRequest, NextResponse } from "next/server";
import { verifyDigestToken } from "@/lib/operations/digest";

export const dynamic = "force-dynamic";

// Public read-only endpoint accessible via the tokenized link sent in the
// daily digest. Returns the snapshot encoded inside the token (24h TTL).
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const payload = verifyDigestToken(params.token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  return NextResponse.json({ generated_at: payload.generated_at, data: payload.data });
}
