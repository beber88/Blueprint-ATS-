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
  | "import";

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
  name: string;
  name_en: string | null;
  name_he: string | null;
  name_tl: string | null;
  description: string | null;
  parent_department_id: string | null;
  head_employee_id: string | null;
  cost_center: string | null;
  created_at: string;
  updated_at: string;
  employee_count?: number;
  children?: Department[];
}

export interface Employee {
  id: string;
  candidate_id: string | null;
  employee_code: string | null;
  full_name: string;
  full_name_en: string | null;
  full_name_he: string | null;
  full_name_tl: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  department_id: string | null;
  hire_date: string | null;
  employment_status: EmploymentStatus;
  birth_date: string | null;
  address: string | null;
  emergency_contact: EmergencyContact;
  government_ids: GovernmentIds;
  photo_url: string | null;
  source: EmployeeSource;
  source_metadata: Record<string, unknown>;
  notes: string | null;
  merged_into_id: string | null;
  created_at: string;
  updated_at: string;
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
  title: string | null;
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
    | "employment_status"
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
