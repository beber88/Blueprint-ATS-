import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCV, analyzeCV } from "@/lib/claude/client";
// pdf-parse v1.1.1 - use direct import to avoid test file that requires canvas
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export const dynamic = "force-dynamic";

function similarityScore(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1;
  const matches = shorter.split("").filter((c, i) => longer[i] === c).length;
  return matches / longer.length;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx"];

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfData = await pdfParse(buffer);
  return pdfData.text || "";
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
    const batchId = formData.get("batchId") as string | null;

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

    // Check for duplicates by email
    if (parsed.email) {
      const { data: existing } = await supabase
        .from("candidates")
        .select("id, full_name, email")
        .eq("email", parsed.email)
        .single();

      if (existing) {
        return NextResponse.json({
          duplicate: true,
          existing_id: existing.id,
          existing_name: existing.full_name,
          message: `Candidate already exists: ${existing.full_name}`,
        }, { status: 409 });
      }
    }

    // Check by name similarity
    if (parsed.full_name && parsed.full_name !== "Unknown") {
      const firstName = parsed.full_name.split(" ")[0];
      if (firstName.length >= 2) {
        const { data: nameMatches } = await supabase
          .from("candidates")
          .select("id, full_name")
          .ilike("full_name", `%${firstName}%`)
          .limit(5);

        if (nameMatches) {
          for (const match of nameMatches) {
            if (similarityScore(match.full_name, parsed.full_name) > 0.85) {
              return NextResponse.json({
                duplicate: true,
                existing_id: match.id,
                existing_name: match.full_name,
                message: `Similar candidate exists: ${match.full_name}`,
              }, { status: 409 });
            }
          }
        }
      }
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
        suggested_job: parsed.suggested_job_category || null,
        classification_confidence: parsed.suggested_job_confidence || null,
        bulk_upload_batch: batchId || null,
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

    // Auto-link to matching job
    if (parsed.suggested_job_category) {
      const { data: matchingJob } = await supabase
        .from("jobs")
        .select("id, title")
        .ilike("title", `%${parsed.suggested_job_category}%`)
        .eq("status", "active")
        .single();

      if (matchingJob) {
        await supabase.from("candidates").update({ job_id: matchingJob.id }).eq("id", candidate.id);
      }
    }

    // Run full AI analysis
    let aiAnalysis = null;
    let jobTitle: string | undefined;
    if (jobId) {
      const { data: job } = await supabase.from("jobs").select("title").eq("id", jobId).single();
      jobTitle = job?.title;
    }
    try {
      aiAnalysis = await analyzeCV(cvText, jobTitle);
      console.log(`CV Upload: AI analysis complete, verdict: ${JSON.stringify((aiAnalysis as Record<string, unknown>)?.verdict)}`);
    } catch (analysisError) {
      console.error("CV Upload: AI analysis failed (non-fatal)", {
        error: analysisError instanceof Error ? analysisError.message : analysisError,
      });
    }

    // Update candidate with job_id and ai_analysis
    if (jobId || aiAnalysis) {
      const updateData: Record<string, unknown> = {};
      if (jobId) updateData.job_id = jobId;
      if (aiAnalysis) updateData.ai_analysis = aiAnalysis;
      await supabase.from("candidates").update(updateData).eq("id", candidate.id);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      candidate_id: candidate.id,
      action: "cv_uploaded",
      details: { file_name: file.name, source: "cv_upload" },
    });

    // If jobId provided, create application with score from analysis
    if (jobId) {
      const totalScore = aiAnalysis ? (aiAnalysis as Record<string, unknown>).total_score as number || 0 : 0;
      const verdict = aiAnalysis ? (aiAnalysis as Record<string, unknown>).verdict as Record<string, unknown> : null;
      await supabase.from("applications").insert({
        candidate_id: candidate.id,
        job_id: jobId,
        ai_score: totalScore || null,
        ai_reasoning: verdict?.summary as string || null,
        status: totalScore ? "scored" : "new",
      });
    }

    return NextResponse.json({ candidate: { ...candidate, ai_analysis: aiAnalysis }, parsed });
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
