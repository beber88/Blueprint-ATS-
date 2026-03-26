import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCV } from "@/lib/claude/client";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx"];

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // pdf-parse v2 uses PDFParse class, not a function
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  await parser.load();
  const result = await parser.getText();
  // Use per-page text to avoid "-- 1 of N --" separators in result.text
  if (result.pages && result.pages.length > 0) {
    return result.pages.map((p: { text: string }) => p.text).join("\n");
  }
  return result.text || "";
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

export async function POST(request: NextRequest) {
  try {
    // Check required env vars
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("CV Upload: Missing Supabase env vars");
      return NextResponse.json({ error: "Server misconfigured: Supabase credentials missing" }, { status: 500 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("CV Upload: Missing ANTHROPIC_API_KEY");
      return NextResponse.json({ error: "Server misconfigured: AI service not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const jobId = formData.get("jobId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`CV Upload: Processing file "${file.name}" (${file.size} bytes, type: ${file.type})`);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Validate file extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF or DOCX." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileId = crypto.randomUUID();
    const fileName = `cvs/${fileId}.${ext}`;

    // Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("cvs")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error("CV Upload: Storage upload failed", { error: uploadError.message, fileName, bucket: "cvs" });
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    console.log(`CV Upload: File stored as ${fileName}`);

    const { data: { publicUrl } } = supabase.storage.from("cvs").getPublicUrl(fileName);

    // Extract text from file
    let cvText = "";
    try {
      if (ext === "pdf") {
        cvText = await extractTextFromPDF(fileBuffer);
      } else if (ext === "docx" || ext === "doc") {
        cvText = await extractTextFromDOCX(fileBuffer);
      }
    } catch (extractError) {
      console.error("CV Upload: Text extraction failed", {
        ext,
        error: extractError instanceof Error ? extractError.message : extractError,
        stack: extractError instanceof Error ? extractError.stack : undefined,
      });
      return NextResponse.json(
        { error: `Failed to extract text from ${ext?.toUpperCase()} file. The file may be corrupted or password-protected.` },
        { status: 400 }
      );
    }

    console.log(`CV Upload: Extracted ${cvText.length} chars of text from ${ext} file`);

    if (!cvText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file. The file may be empty or contain only images." },
        { status: 400 }
      );
    }

    // Parse CV with Claude AI
    let parsed;
    try {
      parsed = await parseCV(cvText);
    } catch (aiError) {
      console.error("CV Upload: AI parsing failed", {
        error: aiError instanceof Error ? aiError.message : aiError,
        stack: aiError instanceof Error ? aiError.stack : undefined,
      });
      return NextResponse.json(
        { error: "AI failed to parse the CV. Please try again or add the candidate manually." },
        { status: 500 }
      );
    }

    console.log(`CV Upload: AI parsed candidate "${parsed.full_name}", ${parsed.skills?.length || 0} skills, ${parsed.experience_years || 0} yrs exp`);

    // Save candidate to database
    const { data: candidate, error: dbError } = await supabase
      .from("candidates")
      .insert({
        full_name: parsed.full_name,
        email: parsed.email,
        phone: parsed.phone,
        location: parsed.location,
        cv_file_url: publicUrl,
        cv_raw_text: cvText,
        skills: parsed.skills,
        experience_years: parsed.experience_years,
        education: parsed.education,
        certifications: parsed.certifications,
        previous_roles: parsed.previous_roles,
        source: "cv_upload",
        status: "new",
      })
      .select()
      .single();

    if (dbError) {
      console.error("CV Upload: DB insert failed", { error: dbError.message, code: dbError.code, details: dbError.details });
      return NextResponse.json(
        { error: `Failed to save candidate: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log(`CV Upload: Candidate saved with ID ${candidate.id}`);

    // Log activity
    await supabase.from("activity_log").insert({
      candidate_id: candidate.id,
      action: "cv_uploaded",
      details: { file_name: file.name, source: "cv_upload" },
    });

    // If jobId provided, create application
    if (jobId) {
      await supabase.from("applications").insert({
        candidate_id: candidate.id,
        job_id: jobId,
        status: "new",
      });
    }

    return NextResponse.json({ candidate, parsed });
  } catch (error) {
    console.error("CV Upload: Unhandled error", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process CV" },
      { status: 500 }
    );
  }
}
