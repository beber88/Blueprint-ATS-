// TS surface for the employee-profile gap-fill module (migration 012).
// Mirrors the table shapes 1:1 so API routes and UI consumers share a
// single source of truth.

export type EmploymentType =
  | "permanent"
  | "fixed_term"
  | "probation"
  | "consultant"
  | "intern";

export type EmploymentContractStatus =
  | "draft"
  | "active"
  | "expired"
  | "terminated"
  | "superseded";

export interface EmploymentContract {
  id: string;
  employee_id: string;
  employment_type: EmploymentType;
  start_date: string;
  end_date: string | null;
  probation_period_days: number | null;
  notice_period_days: number | null;
  working_hours_per_week: number | null;
  working_days: string[] | null;
  salary_base: number | null;
  currency: string | null;
  terms_text: string | null;
  terms_storage_path: string | null;
  obligations_json: unknown[];
  status: EmploymentContractStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SalaryScheduleStatus = "pending" | "applied" | "cancelled";

export interface SalarySchedule {
  id: string;
  employee_id: string;
  scheduled_date: string;
  expected_amount: number;
  currency: string | null;
  reason: string | null;
  status: SalaryScheduleStatus;
  applied_at: string | null;
  applied_salary_id: string | null;
  created_by: string | null;
  created_at: string;
}

export type BenefitType =
  | "health"
  | "transport"
  | "meal"
  | "phone"
  | "education"
  | "car"
  | "housing"
  | "bonus_target"
  | "other";

export interface Benefit {
  id: string;
  employee_id: string;
  type: BenefitType;
  monthly_value: number | null;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type DisciplinaryActionType =
  | "verbal_warning"
  | "written_warning"
  | "nte"
  | "suspension"
  | "final_warning"
  | "demotion"
  | "termination";

export type DisciplinaryStatus = "open" | "closed" | "escalated";

export interface DisciplinaryRecord {
  id: string;
  employee_id: string;
  incident_date: string | null;
  action_date: string;
  action_type: DisciplinaryActionType;
  description: string | null;
  action_taken: string | null;
  follow_up_date: string | null;
  status: DisciplinaryStatus;
  storage_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RecognitionType =
  | "award"
  | "spot_bonus"
  | "public_praise"
  | "certification"
  | "milestone"
  | "promotion_letter";

export interface Recognition {
  id: string;
  employee_id: string;
  date: string;
  type: RecognitionType;
  title: string;
  description: string | null;
  monetary_amount: number | null;
  currency: string | null;
  granted_by: string | null;
  storage_path: string | null;
  created_at: string;
}

export type ComplianceRecordType =
  | "sss"
  | "philhealth"
  | "hdmf"
  | "bir_tin"
  | "work_permit"
  | "visa"
  | "contract_filing"
  | "medical_cert"
  | "nbi_clearance"
  | "other";

export type ComplianceStatus = "valid" | "expired" | "renewing" | "pending";

export interface ComplianceRecord {
  id: string;
  employee_id: string;
  record_type: ComplianceRecordType;
  identifier_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: ComplianceStatus;
  storage_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NoteVisibility = "admin" | "granted";

export interface EmployeeNote {
  id: string;
  employee_id: string;
  author_id: string | null;
  note_text: string;
  visibility: NoteVisibility;
  pinned: boolean;
  parent_note_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HrAlertType =
  | "compliance_expiring"
  | "compliance_expired"
  | "salary_increase_due"
  | "contract_expiring"
  | "probation_ending"
  | "document_expiring";

export type HrAlertSeverity = "low" | "medium" | "high";

export interface HrAlert {
  id: string;
  employee_id: string;
  type: HrAlertType;
  severity: HrAlertSeverity;
  message: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ProfileGrant {
  id: string;
  user_id: string;
  employee_id: string;
  granted_by_user_id: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  note: string | null;
}

// Aggregated counts returned by lib/hr/queries.getEmployeeProfileSummary.
export interface EmployeeProfileSummary {
  employee_id: string;
  active_contract_id: string | null;
  pending_salary_schedule: SalarySchedule | null;
  open_disciplinary_count: number;
  recognitions_count: number;
  expiring_compliance_count: number;
  unresolved_alerts_count: number;
  benefits_count: number;
  notes_count: number;
}
