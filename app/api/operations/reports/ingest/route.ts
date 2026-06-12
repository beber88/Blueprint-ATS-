import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api/auth";
import { createAndProcessReport } from "@/lib/operations/report-intake";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["pdf", "txt"];

/**
 * POST /api/operations/reports/ingest — manual report upload (PDF/TXT/text).
 * Thin wrapper around the unified intake pipeline in
 * lib/operations/report-intake.ts (shared with email ingestion and the
 * queued-report cron).
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireApiAuth({ module: "operations" });
  if (authError) return authError;
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server misconfigured: Supabase credentials missing" }, { status: 500 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const contentType = request.headers.get("content-type") || "";

    let rawText = "";
    let pdfBuffer: Buffer | undefined;
    let sourceType: "pdf" | "text" = "text";
    let reportDate: string | null = null;
    let projectIdHint: string | null = null;
    let originalFileName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const textField = formData.get("text") as string | null;
      reportDate = (formData.get("reportDate") as string | null) || null;
      projectIdHint = (formData.get("projectId") as string | null) || null;

      if (file) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
        }
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
          return NextResponse.json({ error: "Only PDF or TXT files supported on web upload" }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        if (ext === "pdf") {
          sourceType = "pdf";
          pdfBuffer = buffer;
        } else {
          rawText = buffer.toString("utf8");
        }
        originalFileName = file.name;
      } else if (textField) {
        rawText = textField;
      }
    } else {
      const body = await request.json().catch(() => null);
      if (body && typeof body.text === "string") {
        rawText = body.text;
        reportDate = body.reportDate || null;
        projectIdHint = body.projectId || null;
      }
    }

    if (!rawText.trim() && !pdfBuffer) {
      return NextResponse.json({ error: "No report text supplied" }, { status: 400 });
    }

    const result = await createAndProcessReport({
      rawText,
      pdfBuffer,
      sourceType,
      reportDate,
      projectIdHint,
      sourceMeta: { original_filename: originalFileName },
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Ingestion failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      report_id: result.reportId,
      items_count: result.itemsCount,
      confidence: result.confidence,
      report_date: result.reportDate,
      notes: result.notes,
    });
  } catch (error) {
    console.error("ingest: unhandled", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
