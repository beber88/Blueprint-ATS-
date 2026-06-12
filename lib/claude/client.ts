import Anthropic from "@anthropic-ai/sdk";
import { CVParseResult, AIScoreResult } from "@/types";

export type ClaudeLocale = "he" | "en" | "tl";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("FATAL: Missing ANTHROPIC_API_KEY env var");
    throw new Error("Claude AI is not configured. Missing ANTHROPIC_API_KEY.");
  }
  return new Anthropic({ apiKey });
}

function localeName(locale: ClaudeLocale): string {
  if (locale === "he") return "Hebrew (עברית)";
  if (locale === "tl") return "Tagalog";
  return "English";
}

/**
 * Returns a prompt suffix instructing Claude to emit every free-text value
 * in the user's UI locale. Append to any prompt that produces user-visible
 * reasoning, summaries, descriptions, recommendations, or notes. Structural
 * JSON keys, enums, and proper nouns stay as-is — only string *values* are
 * targeted.
 */
function localeInstruction(locale: ClaudeLocale): string {
  return `\n\nLANGUAGE REQUIREMENT (CRITICAL): Every free-text string value in your JSON response MUST be written in ${localeName(locale)}. JSON keys, enum values (e.g. "strong_yes", "HIRE", category keys), email addresses, URLs, and proper nouns (people, companies, product names, technical terms like AutoCAD/Revit) stay as-is. All reasoning, descriptions, notes, summaries, strengths, weaknesses, recommendations, and any other narrative text must be in ${localeName(locale)}. This is non-negotiable — the viewer's UI is set to ${localeName(locale)}.`;
}

function extractJSON<T>(text: string): T {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // noop
  }

  // Try to extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // noop
    }
  }

  // Try to find outermost JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // noop
    }
  }

  throw new Error("Failed to extract JSON from response");
}

export async function parseCV(cvText: string): Promise<CVParseResult> {
  // Truncate very long CVs to avoid token limits
  const truncated = cvText.length > 15000 ? cvText.slice(0, 15000) + "\n...[truncated]" : cvText;

  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are an expert HR assistant. The CV may be in Hebrew, English, or Tagalog (Filipino). Extract the following information and return ONLY valid JSON with no additional text. PRESERVE the original CV's language in all extracted text fields (do not translate education, role descriptions, or skills — keep them as written so the source of truth is faithful). Use detected_language to report which language the CV is written in.

{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "experience_years": number,
  "education": "string (in the CV's original language)",
  "skills": ["array of skills (original language)"],
  "certifications": ["array of certifications (original language)"],
  "previous_roles": [
    {
      "title": "string (original language)",
      "company": "string (proper noun, keep as-is)",
      "duration": "string",
      "description": "string (original language)"
    }
  ],
  "job_categories": ["array of category keys that match this candidate from: architect, architect_licensed, architect_intern, draftsman, engineer, engineer_civil, engineer_structural, engineer_mep, engineer_electrical, engineer_mechanical, project_manager, site_engineer, finance, finance_accountant, finance_controller, finance_bookkeeper, quantity_surveyor, hr, secretary, procurement, marketing, foreman, construction_worker, construction_worker_concrete, construction_worker_iron, construction_worker_formwork, construction_worker_finishing, construction_worker_general, qc_inspector, hse_officer, document_controller, other"],
  "custom_category": "string or null - if 'other' is selected, specify what",
  "suggested_job_confidence": number between 0-100,
  "classification_reasoning": "1 sentence explaining category choice",
  "detected_language": "he | en | tl | unknown"
}

CV Text:
${truncated}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = extractJSON<CVParseResult>(content.text);
  const detected = parsed.detected_language;
  const safeDetected: CVParseResult["detected_language"] =
    detected === "he" || detected === "en" || detected === "tl" ? detected : "unknown";

  // Ensure required fields have defaults
  return {
    full_name: parsed.full_name || "Unknown",
    email: parsed.email || null,
    phone: parsed.phone || null,
    location: parsed.location || null,
    experience_years: parsed.experience_years ?? 0,
    education: parsed.education || "",
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    previous_roles: Array.isArray(parsed.previous_roles) ? parsed.previous_roles : [],
    suggested_job_category: parsed.suggested_job_category || null,
    suggested_job_confidence: parsed.suggested_job_confidence ?? 0,
    classification_reasoning: parsed.classification_reasoning || null,
    job_categories: Array.isArray(parsed.job_categories) ? parsed.job_categories : (parsed.suggested_job_category ? [parsed.suggested_job_category] : []),
    custom_category: parsed.custom_category || null,
    detected_language: safeDetected,
  };
}

export async function scoreCandidate(
  jobTitle: string,
  jobRequirements: string,
  candidateName: string,
  experienceYears: number,
  skills: string[],
  previousRoles: { title: string; company: string; duration: string; description: string }[],
  education: string,
  locale: ClaudeLocale = "en"
): Promise<AIScoreResult> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are a senior recruiter. Evaluate this candidate for the given job position.

JOB TITLE: ${jobTitle}
JOB REQUIREMENTS: ${jobRequirements}

CANDIDATE PROFILE:
Name: ${candidateName}
Experience: ${experienceYears} years
Skills: ${skills.join(", ")}
Previous Roles: ${JSON.stringify(previousRoles)}
Education: ${education}

Return ONLY valid JSON:
{
  "score": number between 0-100,
  "reasoning": "2-3 sentences explaining the score",
  "strengths": ["top 3 strengths"],
  "weaknesses": ["top 2 gaps"],
  "recommendation": "strong_yes | yes | maybe | no"
}${localeInstruction(locale)}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = extractJSON<AIScoreResult>(content.text);

  // Ensure required fields have valid values
  return {
    score: Math.min(100, Math.max(0, Math.round(parsed.score ?? 0))),
    reasoning: parsed.reasoning || "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    recommendation: ["strong_yes", "yes", "maybe", "no"].includes(parsed.recommendation)
      ? parsed.recommendation
      : "maybe",
  };
}

export async function analyzeCV(
  cvText: string,
  jobTitle?: string,
  locale: ClaudeLocale = "en"
): Promise<Record<string, unknown>> {
  const truncated = cvText.length > 15000 ? cvText.slice(0, 15000) + "\n...[truncated]" : cvText;
  const anthropic = getAnthropicClient();

  const analysisPrompt = `You are a senior HR consultant and expert recruiter.
Analyze this CV for the position of: ${jobTitle || 'General Position'}

Return ONLY valid JSON with this exact structure:
{
  "profile_snapshot": {
    "education": "string",
    "certifications": "string",
    "total_experience": "string",
    "current_status": "string"
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "scorecard": [
    {"criterion": "Technical Qualifications", "max": 25, "score": 0, "notes": ""},
    {"criterion": "Relevant Experience", "max": 25, "score": 0, "notes": ""},
    {"criterion": "Tools & Software", "max": 15, "score": 0, "notes": ""},
    {"criterion": "Communication Skills", "max": 15, "score": 0, "notes": ""},
    {"criterion": "Leadership & Management", "max": 10, "score": 0, "notes": ""},
    {"criterion": "Problem Solving", "max": 10, "score": 0, "notes": ""}
  ],
  "total_score": 0,
  "experience_gaps": ["gap1", "gap2"],
  "interview_questions": [
    {"question": "string", "type": "Technical|Behavioral|Clarification", "purpose": "string"}
  ],
  "verdict": {
    "score": 0,
    "recommendation": "HIRE|HOLD|REJECT",
    "level": "Junior|Mid|Senior",
    "summary": "one line reason"
  },
  "interviewer_notes": "string"
}

CV Text:
${truncated}

PROFESSION-SPECIFIC EVALUATION:
If the candidate is in construction/engineering:
- Weight heavily: relevant certifications, safety training, project management experience, site experience
- Check for: professional engineering license, safety certifications (OSHA, etc.), software proficiency (AutoCAD, Revit, etc.)

If the candidate is in architecture:
- Weight heavily: architectural license, design portfolio, software skills (AutoCAD, Revit, SketchUp, 3ds Max)
- Check for: registered architect status, competition wins, notable projects

If the candidate is in finance/accounting:
- Weight heavily: CPA/accounting certifications, ERP experience, financial analysis skills
- Check for: audit experience, regulatory knowledge, budgeting expertise

If the candidate is in HR:
- Weight heavily: HR certifications, recruitment experience, labor law knowledge
- Check for: ATS experience, employee relations, training & development

If the candidate is in construction labor:
- Weight heavily: physical fitness, safety training, specific trade skills
- Check for: trade certifications, years of hands-on experience, equipment operation

Adjust scoring criteria based on the specific profession. Be strict for senior roles, lenient for entry-level.

Important: Base analysis strictly on CV content. Flag missing info as "Not mentioned". Be direct and honest about weaknesses.${localeInstruction(locale)}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [{ role: "user", content: analysisPrompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return extractJSON<Record<string, unknown>>(content.text);
}

export interface DocumentClassification {
  document_type: "cv" | "portfolio" | "certification" | "license" | "reference_letter" | "id_document" | "education_certificate" | "other";
  confidence: number;
  person_name: string | null;
  person_email: string | null;
  description: string;
  reasoning: string;
}

export async function classifyDocument(
  text: string,
  fileName: string,
  locale: ClaudeLocale = "en"
): Promise<DocumentClassification> {
  const truncated = text.length > 5000 ? text.slice(0, 5000) + "\n...[truncated]" : text;
  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `You are a document classification expert. Analyze this document and determine what type it is.

File name: ${fileName}

Document text (first 5000 chars):
${truncated}

Return ONLY valid JSON:
{
  "document_type": "cv | portfolio | certification | license | reference_letter | id_document | education_certificate | other",
  "confidence": number 0-100,
  "person_name": "full name of the person this document belongs to, or null",
  "person_email": "email if found in document, or null",
  "description": "brief description of what this document contains",
  "reasoning": "1 sentence explaining why you classified it this way"
}

Classification rules:
- "cv" = Resume/CV with work experience, education, skills
- "portfolio" = Collection of projects, designs, work samples, images described
- "certification" = Professional certification, training completion, course certificate
- "license" = Professional license (engineering, architecture, accounting, etc.)
- "reference_letter" = Letter of recommendation from employer/colleague
- "id_document" = ID card, passport, or similar identity document
- "education_certificate" = University degree, diploma, academic transcript
- "other" = Anything that doesn't fit above categories

CRITICAL: Extract the person's name accurately. Check for name in header, signature, or "prepared by" sections.${localeInstruction(locale)}`
    }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  return extractJSON<DocumentClassification>(content.text);
}
