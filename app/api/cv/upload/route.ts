import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCV, analyzeCV, classifyDocument } from "@/lib/claude/client";
import { similarityScore } from "@/lib/utils";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
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

// Find candidate by name or email match
async function findMatchingCandidate(
  supabase: ReturnType<typeof createAdminClient>,
  name: string | null,
  email: string | null
): Promise<{ id: string; full_name: string } | null> {
  // Try email first (exact match)
  if (email) {
    const { data } = await supabase.from("candidates").select("id, full_name").eq("email", email).single();
    if (data) return data;
  }

  // Try name match
  if (name && name.length > 2) {
    const firstName = name.split(" ")[0];
    const { data: matches } = await supabase
      .from("candidates")
      .select("id, full_name")
      .ilike("full_name", `%${firstName}%`)
      .limit(10);

    if (matches) {
      for (const match of matches) {
        if (similarityScore(match.full_name, name) > 0.75) {
          return match;
        }
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server misconfigured: Supabase credentials missing" }, { status: 500 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Server misconfigured: AI service not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const jobId = formData.get("jobId") as string | null;
    const batchId = formData.get("batchId") as string | null;
    const forceType = formData.get("forceType") as string | null; // "cv" to skip classification

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    console.log(`Upload: Processing "${file.name}" (${file.size} bytes)`);

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Unsupported file type. PDF or DOCX only." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileId = crypto.randomUUID();

    // Extract text
    let extractedText = "";
    try {
      if (ext === "pdf") extractedText = await extractTextFromPDF(fileBuffer);
      else extractedText = await extractTextFromDOCX(fileBuffer);
    } catch (err) {
      console.error("Upload: Text extraction failed", { error: err instanceof Error ? err.message : err });
      return NextResponse.json({ error: "Failed to extract text from file." }, { status: 400 });
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: "Could not extract text. File may be empty or image-only." }, { status: 400 });
    }

    console.log(`Upload: Extracted ${extractedText.length} chars`);

    // ═══════════════════════════════════════════
    // STEP 1: CLASSIFY THE DOCUMENT WITH AI
    // ═══════════════════════════════════════════
    let docType = forceType || "cv";
    let classification = null;

    if (!forceType) {
      try {
        classification = await classifyDocument(extractedText, file.name);
        docType = classification.document_type;
        console.log(`Upload: Classified as "${docType}" (${classification.confidence}%) - ${classification.reasoning}`);
      } catch (classErr) {
        console.error("Upload: Classification failed, defaulting to CV", { error: classErr instanceof Error ? classErr.message : classErr });
        docType = "cv";
      }
    }

    // ═══════════════════════════════════════════
    // STEP 2: ROUTE BASED ON DOCUMENT TYPE
    // ═══════════════════════════════════════════

    if (docType === "cv") {
      // ══════════ CV PROCESSING (existing flow) ══════════
      const fileName = `cvs/${fileId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("cvs").upload(fileName, fileBuffer, { contentType: file.type });
      if (uploadError) {
        console.error("Upload: Storage failed", { error: uploadError.message });
        return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
      }

      const { data: { publicUrl } } = supabase.storage.from("cvs").getPublicUrl(fileName);

      // Parse CV with AI
      let parsed;
      try {
        parsed = await parseCV(extractedText);
      } catch (aiError) {
        console.error("Upload: AI parsing failed", { error: aiError instanceof Error ? aiError.message : aiError });
        return NextResponse.json({ error: "AI failed to parse CV." }, { status: 500 });
      }

      console.log(`Upload: Parsed "${parsed.full_name}"`);

      // Deduplication
      if (parsed.email) {
        const { data: existing } = await supabase.from("candidates").select("id, full_name, email").eq("email", parsed.email).single();
        if (existing) {
          return NextResponse.json({ duplicate: true, existing_id: existing.id, existing_name: existing.full_name, message: `Candidate already exists: ${existing.full_name}` }, { status: 409 });
        }
      }

      if (parsed.full_name && parsed.full_name !== "Unknown") {
        const firstName = parsed.full_name.split(" ")[0];
        if (firstName.length >= 2) {
          const { data: nameMatches } = await supabase.from("candidates").select("id, full_name").ilike("full_name", `%${firstName}%`).limit(5);
          if (nameMatches) {
            for (const match of nameMatches) {
              if (similarityScore(match.full_name, parsed.full_name) > 0.85) {
                return NextResponse.json({ duplicate: true, existing_id: match.id, existing_name: match.full_name, message: `Similar candidate exists: ${match.full_name}` }, { status: 409 });
              }
            }
          }
        }
      }

      // Save candidate
      const { data: candidate, error: dbError } = await supabase.from("candidates").insert({
        full_name: parsed.full_name,
        email: parsed.email,
        phone: parsed.phone,
        location: parsed.location,
        cv_file_url: publicUrl,
        cv_raw_text: extractedText,
        skills: parsed.skills,
        experience_years: parsed.experience_years,
        education: parsed.education,
        certifications: parsed.certifications,
        previous_roles: parsed.previous_roles,
        source: "cv_upload",
        status: "new",
        job_categories: parsed.job_categories || [],
        custom_category: parsed.custom_category || null,
        suggested_job: (parsed.job_categories || [])[0] || parsed.suggested_job_category || null,
        classification_confidence: parsed.suggested_job_confidence || null,
        bulk_upload_batch: batchId || null,
      }).select().single();

      if (dbError) {
        console.error("Upload: DB insert failed", { error: dbError.message });
        return NextResponse.json({ error: `Failed to save: ${dbError.message}` }, { status: 500 });
      }

      // Auto-link to job
      if (parsed.job_categories && parsed.job_categories.length > 0 && !jobId) {
        for (const cat of parsed.job_categories) {
          const { data: matchingJob } = await supabase.from("jobs").select("id, title").ilike("title", `%${cat.replace(/_/g, " ")}%`).eq("status", "active").single();
          if (matchingJob) {
            await supabase.from("candidates").update({ job_id: matchingJob.id }).eq("id", candidate.id);
            break;
          }
        }
      }

      // Run AI analysis
      let aiAnalysis = null;
      let jobTitle: string | undefined;
      if (jobId) {
        const { data: job } = await supabase.from("jobs").select("title").eq("id", jobId).single();
        jobTitle = job?.title;
      }
      try {
        aiAnalysis = await analyzeCV(extractedText, jobTitle);
        console.log(`Upload: AI analysis done`);
      } catch (err) {
        console.error("Upload: AI analysis failed (non-fatal)", { error: err instanceof Error ? err.message : err });
      }

      if (jobId || aiAnalysis) {
        const updateData: Record<string, unknown> = {};
        if (jobId) updateData.job_id = jobId;
        if (aiAnalysis) updateData.ai_analysis = aiAnalysis;
        await supabase.from("candidates").update(updateData).eq("id", candidate.id);
      }

      await supabase.from("activity_log").insert({
        candidate_id: candidate.id,
        action: "cv_uploaded",
        details: { file_name: file.name, source: "cv_upload", classification: docType },
      });

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

      return NextResponse.json({
        candidate: { ...candidate, ai_analysis: aiAnalysis },
        parsed,
        document_type: "cv",
        classification,
      });

    } else {
      // ══════════ NON-CV DOCUMENT — attach to existing candidate ══════════
      console.log(`Upload: Non-CV document (${docType}), finding matching candidate...`);

      const personName = classification?.person_name || null;
      const personEmail = classification?.person_email || null;

      // Upload to documents bucket
      const docFileName = `${fileId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(docFileName, fileBuffer, { contentType: file.type });
      if (uploadError) {
        // Fallback to cvs bucket
        await supabase.storage.from("cvs").upload(`docs/${docFileName}`, fileBuffer, { contentType: file.type });
      }

      const bucket = uploadError ? "cvs" : "documents";
      const path = uploadError ? `docs/${docFileName}` : docFileName;
      const { data: { publicUrl: docUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

      // Find the candidate this document belongs to
      const matchedCandidate = await findMatchingCandidate(supabase, personName, personEmail);

      if (matchedCandidate) {
        // Attach document to candidate
        const { data: candData } = await supabase.from("candidates").select("documents").eq("id", matchedCandidate.id).single();
        const existingDocs = (candData?.documents as { name: string; url: string; type: string; uploaded_at: string; description?: string }[]) || [];

        const newDoc = {
          name: file.name,
          url: docUrl,
          type: docType,
          uploaded_at: new Date().toISOString(),
          description: classification?.description || "",
        };

        await supabase.from("candidates").update({
          documents: [...existingDocs, newDoc],
        }).eq("id", matchedCandidate.id);

        await supabase.from("activity_log").insert({
          candidate_id: matchedCandidate.id,
          action: "document_uploaded",
          details: { file_name: file.name, doc_type: docType, auto_matched: true },
        });

        console.log(`Upload: Document attached to "${matchedCandidate.full_name}" (${matchedCandidate.id})`);

        return NextResponse.json({
          document_type: docType,
          classification,
          attached_to: {
            id: matchedCandidate.id,
            full_name: matchedCandidate.full_name,
          },
          document: {
            name: file.name,
            url: docUrl,
            type: docType,
          },
          message: `Document "${file.name}" attached to ${matchedCandidate.full_name}`,
        });

      } else {
        // No matching candidate found — return info so user can manually assign
        console.log(`Upload: No matching candidate found for "${personName || file.name}"`);

        return NextResponse.json({
          document_type: docType,
          classification,
          attached_to: null,
          document: {
            name: file.name,
            url: docUrl,
            type: docType,
          },
          unmatched: true,
          message: `Document classified as "${docType}" but no matching candidate found. Person: ${personName || "unknown"}`,
        });
      }
    }
  } catch (error) {
    console.error("Upload: Unhandled error", { error: error instanceof Error ? error.message : error, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process file" }, { status: 500 });
  }
}
