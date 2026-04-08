import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ═══════════════════════════════════
// STORAGE
// ═══════════════════════════════════

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ═══════════════════════════════════
// FILE RECORDS
// ═══════════════════════════════════

export const getUnmatched = query({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db
      .query("candidateFiles")
      .withIndex("by_match_status", (q) => q.eq("match_status", "unmatched"))
      .collect();

    // Get all candidates for potential matching suggestions
    const candidates = await ctx.db.query("candidates").collect();
    const candidateList = candidates.map(c => ({
      id: c._id,
      full_name: c.full_name,
      email: c.email,
    }));

    return {
      files,
      candidates: candidateList,
    };
  },
});

export const assignFile = mutation({
  args: {
    fileId: v.id("candidateFiles"),
    candidateId: v.id("candidates"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      candidate_id: args.candidateId,
      match_status: "manual",
    });

    // Also add to candidate's documents array
    const file = await ctx.db.get(args.fileId);
    if (file) {
      const candidate = await ctx.db.get(args.candidateId);
      if (candidate) {
        const docs = candidate.documents || [];
        docs.push({
          name: file.file_name,
          url: file.file_url || "",
          type: file.file_type || "other",
          uploaded_at: new Date(file.created_at).toISOString(),
        });
        await ctx.db.patch(args.candidateId, { documents: docs, updated_at: Date.now() });
      }
    }

    return args.fileId;
  },
});

export const createFileRecord = mutation({
  args: {
    candidate_id: v.optional(v.id("candidates")),
    file_name: v.string(),
    file_url: v.optional(v.string()),
    storage_id: v.optional(v.id("_storage")),
    file_type: v.optional(v.string()),
    file_size: v.optional(v.number()),
    detected_name: v.optional(v.string()),
    detected_email: v.optional(v.string()),
    match_status: v.optional(v.string()),
    raw_text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("candidateFiles", {
      ...args,
      match_status: args.match_status || "unmatched",
      created_at: Date.now(),
    });
  },
});

// ═══════════════════════════════════
// CV UPLOAD (Action - calls external APIs)
// ═══════════════════════════════════

export const processCV = action({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    // 1. Get file from storage
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) throw new Error("File not found in storage");

    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 2. Extract text from PDF/DOCX
    let text = "";
    const ext = args.fileName.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const pdfData = await pdfParse(buffer);
      text = pdfData.text || "";
    } else if (ext === "docx" || ext === "doc") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    }

    if (!text.trim()) {
      throw new Error("Could not extract text from file");
    }

    // 3. Parse CV with Claude
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const truncated = text.length > 15000 ? text.slice(0, 15000) + "\n...[truncated]" : text;

    const parseMessage = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are an expert HR assistant. Extract the following information from this CV text and return ONLY valid JSON:
{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "experience_years": number,
  "education": "string",
  "skills": ["array of skills"],
  "certifications": ["array of certifications"],
  "previous_roles": [{"title":"string","company":"string","duration":"string","description":"string"}],
  "job_categories": ["array of category keys from: architect, architect_licensed, architect_intern, draftsman, engineer, engineer_civil, engineer_structural, engineer_mep, engineer_electrical, engineer_mechanical, project_manager, site_engineer, finance, finance_accountant, finance_controller, finance_bookkeeper, quantity_surveyor, hr, secretary, procurement, marketing, foreman, construction_worker, construction_worker_concrete, construction_worker_iron, construction_worker_formwork, construction_worker_finishing, construction_worker_general, qc_inspector, hse_officer, document_controller, other"],
  "custom_category": "string or null",
  "suggested_job_confidence": number 0-100
}

CV Text:
${truncated}`,
      }],
    });

    const parseContent = parseMessage.content[0];
    if (parseContent.type !== "text") throw new Error("Parse failed");

    let parsed;
    try {
      const jsonMatch = parseContent.text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : parseContent.text);
    } catch {
      throw new Error("Failed to parse CV data");
    }

    // 4. Create candidate record
    const candidateId = await ctx.runMutation(api.candidates.create, {
      full_name: parsed.full_name || "Unknown",
      email: parsed.email || undefined,
      phone: parsed.phone || undefined,
      location: parsed.location || undefined,
      experience_years: parsed.experience_years || 0,
      education: parsed.education || undefined,
      skills: parsed.skills || [],
      certifications: parsed.certifications || [],
      previous_roles: parsed.previous_roles || [],
      job_categories: parsed.job_categories || [],
      custom_category: parsed.custom_category || undefined,
      classification_confidence: parsed.suggested_job_confidence || 0,
      cv_raw_text: text,
      cv_storage_id: args.storageId,
      source: "upload",
      job_id: args.jobId,
    });

    // 5. Create file record
    await ctx.runMutation(api.files.createFileRecord, {
      candidate_id: candidateId,
      file_name: args.fileName,
      storage_id: args.storageId,
      file_type: "cv",
      match_status: "matched",
      raw_text: text.slice(0, 5000),
    });

    return { candidateId, parsed };
  },
});

export const scoreCandidate = action({
  args: {
    candidateId: v.id("candidates"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const candidate = await ctx.runQuery(api.candidates.getById, { id: args.candidateId });
    const job = await ctx.runQuery(api.jobs.getById, { id: args.jobId });

    if (!candidate || !job) throw new Error("Candidate or job not found");

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Score this candidate for the job. Return ONLY valid JSON:
{
  "score": number 0-100,
  "reasoning": "2-3 sentences",
  "strengths": ["top 3"],
  "weaknesses": ["top 2"],
  "recommendation": "strong_yes | yes | maybe | no"
}

JOB: ${job.title} - ${job.requirements || ""}
CANDIDATE: ${candidate.full_name}, ${candidate.experience_years || 0} years exp
Skills: ${(candidate.skills || []).join(", ")}
Education: ${candidate.education || "N/A"}
Roles: ${JSON.stringify(candidate.previous_roles || [])}`,
      }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Score failed");

    let result;
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content.text);
    } catch {
      throw new Error("Failed to parse score");
    }

    return result;
  },
});
