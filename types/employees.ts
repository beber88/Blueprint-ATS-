/**
 * HRIS types backed by existing op_employees / op_departments / hr_employee_documents tables.
 * Phase 1 (rebased) keeps the historical column names (`role`, `is_active`, `date_of_birth`,
 * `national_id`) and adds new HRIS columns (`position`, `employment_status`, `government_ids`,
 * multi-language names, etc.) via additive migration 002.
 */

export type EmploymentStatus =
  | "active"
  | "probation"
  | "on_leave"
  | "terminated"
  | "resigned";

export type EmployeeSource =
  | "manual"
  | "drive_sync"
  | "migrated_from_candidate"
  | "import"
  | "seed";

export type DocumentType =
  | "contract"
  | "id"
  | "certificate"
  | "payslip"
  | "government"
  | "warning"
  | "achievement"
  | "report"
  | "attendance"
  | "medical"
  | "tax"
  | "other";

export type DocumentLanguage = "he" | "en" | "tl" | "unknown";

export interface GovernmentIds {
  sss_no?: string | null;
  philhealth_no?: string | null;
  pagibig_no?: string | null;
  tin?: string | null;
  passport_no?: string | null;
  national_id?: string | null;
}

export interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  name_he: string | null;
  name_tl: string | null;
  description: string | null;
  parent_department_id: string | null;
  head_employee_id: string | null;
  cost_center: string | null;
  color: string | null;
  created_at: string;
  updated_at: string | null;
  employee_count?: number;
  children?: Department[];
}

export interface Employee {
  id: string;
  // Core identity
  full_name: string;
  full_name_en: string | null;
  full_name_he: string | null;
  full_name_tl: string | null;
  employee_code: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  // Employment
  position: string | null;
  role: string | null; // legacy column kept for backward compat
  department_id: string | null;
  project_id: string | null;
  is_pm: boolean | null;
  is_active: boolean;
  employment_status: EmploymentStatus;
  employment_type: string | null;
  hire_date: string | null;
  manager_id: string | null;
  salary_grade: string | null;
  // Personal
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  emergency_contact: EmergencyContact;
  national_id: string | null;
  government_ids: GovernmentIds;
  photo_url: string | null;
  // Recruitment link
  candidate_id: string | null;
  user_profile_id: string | null;
  // Provenance
  source: EmployeeSource;
  source_metadata: Record<string, unknown>;
  notes: string | null;
  merged_into_id: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Joined
  department?: Department | null;
  documents?: EmployeeDocument[];
  timeline?: EmployeeTimelineEvent[];
}

export interface DocumentProvenance {
  source?: "manual" | "drive_sync" | "upload";
  source_folder?: string;
  drive_file_id?: string;
  imported_at?: string;
  original_date?: string;
  importer_user_id?: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: DocumentType;
  title: string;
  storage_path: string;
  file_url: string | null;
  file_hash: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  original_language: DocumentLanguage | null;
  drive_file_id: string | null;
  provenance: DocumentProvenance;
  metadata: Record<string, unknown>;
  uploaded_by: string | null;
  notes: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface EmployeeTimelineEvent {
  id: string;
  employee_id: string;
  event_type: string;
  event_date: string;
  title: string | null;
  description: string | null;
  related_table: string | null;
  related_id: string | null;
  actor_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EmployeeListItem
  extends Pick<
    Employee,
    | "id"
    | "full_name"
    | "employee_code"
    | "email"
    | "phone"
    | "position"
    | "role"
    | "employment_status"
    | "is_active"
    | "hire_date"
    | "photo_url"
    | "created_at"
  > {
  department?: { id: string; name: string } | null;
}

export const DOCUMENT_TYPE_LABEL_KEY: Record<DocumentType, string> = {
  contract: "employees.documents.types.contract",
  id: "employees.documents.types.id",
  certificate: "employees.documents.types.certificate",
  payslip: "employees.documents.types.payslip",
  government: "employees.documents.types.government",
  warning: "employees.documents.types.warning",
  achievement: "employees.documents.types.achievement",
  report: "employees.documents.types.report",
  attendance: "employees.documents.types.attendance",
  medical: "employees.documents.types.medical",
  tax: "employees.documents.types.tax",
  other: "employees.documents.types.other",
};

export const EMPLOYMENT_STATUS_LABEL_KEY: Record<EmploymentStatus, string> = {
  active: "employees.status.active",
  probation: "employees.status.probation",
  on_leave: "employees.status.on_leave",
  terminated: "employees.status.terminated",
  resigned: "employees.status.resigned",
};
