import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCV } from "@/lib/claude/client";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const jobId = formData.get("jobId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

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
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage.from("cvs").getPublicUrl(fileName);

    // Extract text from file
    let cvText = "";
    try {
      if (ext === "pdf") {
        const pdfData = await pdfParse(fileBuffer);
        cvText = pdfData.text;
      } else if (ext === "docx" || ext === "doc") {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        cvText = result.value;
      }
    } catch (extractError) {
      console.error("Text extraction error:", extractError);
      return NextResponse.json(
        { error: "Failed to extract text from file. The file may be corrupted or password-protected." },
        { status: 400 }
      );
    }

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
      console.error("AI parsing error:", aiError);
      return NextResponse.json(
        { error: "AI failed to parse the CV. Please try again or add the candidate manually." },
        { status: 500 }
      );
    }

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
      console.error("DB error:", dbError);
      return NextResponse.json(
        { error: `Failed to save candidate: ${dbError.message}` },
        { status: 500 }
      );
    }

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
    console.error("CV upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process CV" },
      { status: 500 }
    );
  }
}
