import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}

function extractJSON<T>(text: string): T {
  try { return JSON.parse(text) as T; } catch { /* noop */ }
  const code = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (code) {
    try { return JSON.parse(code[1].trim()) as T; } catch { /* noop */ }
  }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]) as T;
  throw new Error("Failed to extract JSON from Claude response");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailCategory =
  | "leave_request"
  | "sick_day"
  | "attendance_report"
  | "employee_update"
  | "salary_query"
  | "equipment_request"
  | "training_request"
  | "onboarding_task"
  | "offboarding_task"
  | "performance_review"
  | "shift_change"
  | "general_hr"
  | "not_hr"
  | "daily_operations_report"
  | "weekly_operations_report"
  | "project_update"
  | "safety_incident";

export interface EmailClassification {
  category: EmailCategory;
  confidence: number;
  summary: string;
  employee_name: string | null;
  dates: { start?: string; end?: string; single?: string } | null;
  extracted_data: Record<string, unknown>;
  suggested_action: string | null;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an HR email classifier for Blueprint Building Group, a Philippine construction company.
You receive emails from the HR Manager (Nicx) and classify them into actionable categories.

The company uses a multi-module HR system. Your job is to:
1. Classify the email into a category
2. Extract structured data for routing to the correct module
3. Identify the employee(s) involved
4. Extract dates when relevant

CATEGORIES:
- leave_request: Employee requesting vacation, personal leave, etc.
- sick_day: Employee calling in sick or medical leave
- attendance_report: Daily/weekly attendance summaries, late arrivals, absences
- employee_update: Changes to employee details (role change, transfer, promotion, personal info update)
- salary_query: Salary-related questions, payslip issues, allowance requests
- equipment_request: Request for laptop, phone, PPE, tools, vehicle
- training_request: Training enrollment, certification, course completion
- onboarding_task: New employee onboarding items (documents needed, orientation schedule)
- offboarding_task: Employee resignation, termination, exit process
- performance_review: Performance feedback, evaluation results, goal setting
- shift_change: Shift schedule changes, overtime requests
- general_hr: HR-related but doesn't fit specific categories
- not_hr: Not HR-related, ignore
- daily_operations_report: Daily field/site/operations report (attendance, progress, issues)
- weekly_operations_report: Weekly summary or roundup report
- project_update: Project-specific status update or progress report
- safety_incident: Safety incident, accident, or near-miss report

OUTPUT JSON SHAPE (return ONLY this — no prose, no markdown):
{
  "category": "leave_request | sick_day | attendance_report | employee_update | salary_query | equipment_request | training_request | onboarding_task | offboarding_task | performance_review | shift_change | general_hr | not_hr | daily_operations_report | weekly_operations_report | project_update | safety_incident",
  "confidence": 0.0 to 1.0,
  "summary": "One-sentence summary of the email content",
  "employee_name": "Name of the employee this is about (or null if not about a specific employee)",
  "dates": {
    "start": "YYYY-MM-DD or null — start date for leave/absence",
    "end": "YYYY-MM-DD or null — end date for leave/absence",
    "single": "YYYY-MM-DD or null — single relevant date"
  },
  "extracted_data": {
    // Category-specific fields:
    // leave_request: { leave_type, days_count, reason }
    // sick_day: { reason, doctor_note }
    // attendance_report: { present_count, absent_names, late_names }
    // employee_update: { update_type, old_value, new_value }
    // equipment_request: { asset_type, brand, reason }
    // training_request: { course_name, provider, duration }
    // onboarding_task: { new_employee_name, start_date, position }
    // offboarding_task: { employee_name, last_day, reason }
    // shift_change: { shift_type, date, reason }
    // daily_operations_report: { site_name, present_count, absent_names, issues, materials_used }
    // weekly_operations_report: { week_ending, highlights, blockers, metrics }
    // project_update: { project_name, milestone, status, percent_complete }
    // safety_incident: { incident_type, location, severity, injured_persons, description }
  },
  "suggested_action": "Brief suggested next step for the system (or null)"
}

OPERATIONS CLASSIFICATION RULES:
- If the email contains a structured daily report with attendance, site progress, issues, materials, or operational updates, classify as daily_operations_report
- If the email contains a weekly summary, weekly roundup, or end-of-week report, classify as weekly_operations_report
- If the email focuses on a specific project's status, milestones, or deliverables, classify as project_update
- If the email reports a safety incident, accident, injury, or near-miss, classify as safety_incident

RULES:
- Hebrew/Tagalog/English mixing is expected. Parse all languages.
- Preserve employee names verbatim (Nicx, MC, James, Jester, etc.).
- For dates: produce best-effort YYYY-MM-DD. If relative (e.g. "tomorrow", "next Monday"), resolve relative to today.
- If an email contains multiple topics, classify by the PRIMARY topic.
- Be conservative with confidence — only use > 0.9 for clear-cut cases.
- If not HR-related at all, set category="not_hr" and confidence=1.0.

Return JSON only.`;

// ---------------------------------------------------------------------------
// Classify an email
// ---------------------------------------------------------------------------

export async function classifyEmail(
  subject: string | null,
  bodyText: string | null,
  fromName: string | null,
  today: string = new Date().toISOString().slice(0, 10)
): Promise<EmailClassification> {
  const client = getClient();

  const userMessage = [
    `Today's date: ${today}`,
    "",
    `From: ${fromName || "Unknown"}`,
    `Subject: ${subject || "(no subject)"}`,
    "",
    "Email body:",
    "```",
    (bodyText || "(empty)").slice(0, 15000),
    "```",
    "",
    "Classify this email and return JSON.",
  ].join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") throw new Error("Unexpected Claude response type");

  const parsed = extractJSON<EmailClassification>(block.text);

  // Normalize
  const validCategories: EmailCategory[] = [
    "leave_request", "sick_day", "attendance_report", "employee_update",
    "salary_query", "equipment_request", "training_request", "onboarding_task",
    "offboarding_task", "performance_review", "shift_change", "general_hr", "not_hr",
    "daily_operations_report", "weekly_operations_report", "project_update", "safety_incident",
  ];

  return {
    category: validCategories.includes(parsed.category) ? parsed.category : "general_hr",
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    employee_name: typeof parsed.employee_name === "string" ? parsed.employee_name : null,
    dates: parsed.dates || null,
    extracted_data: parsed.extracted_data || {},
    suggested_action: typeof parsed.suggested_action === "string" ? parsed.suggested_action : null,
  };
}

// ---------------------------------------------------------------------------
// Map category to route target
// ---------------------------------------------------------------------------

export function categoryToRoute(category: EmailCategory): string | null {
  const map: Record<EmailCategory, string | null> = {
    leave_request: "leave",
    sick_day: "leave",
    attendance_report: "attendance",
    employee_update: "employee",
    salary_query: "salary",
    equipment_request: "assets",
    training_request: "training",
    onboarding_task: "onboarding",
    offboarding_task: "offboarding",
    performance_review: "reviews",
    shift_change: "shifts",
    general_hr: "general",
    not_hr: null,
    daily_operations_report: "operations",
    weekly_operations_report: "operations",
    project_update: "operations",
    safety_incident: "operations",
  };
  return map[category];
}
