// Shared TS types for the Operations Intelligence module.

export type ItemStatus = "open" | "in_progress" | "blocked" | "resolved";
export type ItemPriority = "low" | "medium" | "high" | "urgent";
export type ItemCategory =
  | "hr"
  | "attendance"
  | "safety"
  | "project"
  | "permit"
  | "procurement"
  | "subcontractor"
  | "site"
  | "other";

export type ReportSourceType = "pdf" | "whatsapp" | "text" | "image";
export type ProcessingStatus = "queued" | "processing" | "completed" | "failed";

export interface ExtractedItem {
  department: string | null;
  project: string | null;
  person_responsible: string | null;
  issue: string;
  status: ItemStatus;
  deadline: string | null;        // ISO date (yyyy-mm-dd) or null
  deadline_raw: string | null;    // verbatim string from the report
  deadline_uncertain: boolean;
  missing_information: string | null;
  ceo_decision_needed: boolean;
  priority: ItemPriority;
  next_action: string | null;
  category: ItemCategory;
}

export interface ExtractedReport {
  items: ExtractedItem[];
  confidence: number; // 0..1
  model: string;
  report_date: string | null;
  notes: string | null;
}

export interface OpDepartment {
  id: string;
  code: string;
  name: string;
  name_he: string | null;
  name_en: string | null;
  name_tl: string | null;
  color: string | null;
}

export interface OpProject {
  id: string;
  code: string | null;
  name: string;
  status: "active" | "paused" | "completed";
  department_id: string | null;
  started_at: string | null;
}

export interface OpEmployee {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  role: string | null;
  department_id: string | null;
  project_id: string | null;
  is_pm: boolean;
  is_active: boolean;
}

export interface OpReportItem {
  id: string;
  report_id: string;
  report_date: string;
  department_id: string | null;
  department_raw: string | null;
  project_id: string | null;
  project_raw: string | null;
  person_responsible_id: string | null;
  person_responsible_raw: string | null;
  person_responsible_match_confidence: number | null;
  issue: string;
  status: ItemStatus;
  deadline: string | null;
  deadline_raw: string | null;
  deadline_uncertain: boolean;
  missing_information: string | null;
  ceo_decision_needed: boolean;
  priority: ItemPriority;
  next_action: string | null;
  category: ItemCategory;
  extra: Record<string, unknown>;
  history: Array<Record<string, unknown>>;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpAlert {
  id: string;
  item_id: string | null;
  project_id: string | null;
  type: "overdue" | "missing_report" | "repeated" | "critical";
  severity: ItemPriority;
  message: string;
  resolved_at: string | null;
  created_at: string;
}
