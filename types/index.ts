export interface Job {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  requirements: string | null;
  location: string | null;
  employment_type: string;
  status: "active" | "paused" | "closed";
  created_at: string;
  updated_at: string;
  candidate_count?: number;
  top_score?: number;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  cv_file_url: string | null;
  cv_raw_text: string | null;
  skills: string[] | null;
  experience_years: number | null;
  education: string | null;
  certifications: string[] | null;
  previous_roles: PreviousRole[] | null;
  notes: string | null;
  source: string;
  status: CandidateStatus;
  created_at: string;
  updated_at: string;
}

export type CandidateStatus =
  | "new"
  | "reviewed"
  | "shortlisted"
  | "interview_scheduled"
  | "interviewed"
  | "approved"
  | "rejected"
  | "keep_for_future";

export interface PreviousRole {
  title: string;
  company: string;
  duration: string;
  description: string;
}

export interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  ai_score: number | null;
  ai_reasoning: string | null;
  status: string;
  applied_at: string;
  job?: Job;
  candidate?: Candidate;
}

export interface Interview {
  id: string;
  application_id: string;
  scheduled_at: string | null;
  duration_minutes: number;
  interviewer: string | null;
  type: "in-person" | "video" | "phone";
  notes: string | null;
  outcome: string | null;
  created_at: string;
  application?: Application & { candidate?: Candidate; job?: Job };
}

export interface ActivityLog {
  id: string;
  candidate_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  type: "email" | "whatsapp";
  category: "interview_invite" | "rejection" | "next_stage" | "offer" | "general";
  subject: string | null;
  body: string;
  variables: string[] | null;
  created_at: string;
}

export interface MessageSent {
  id: string;
  candidate_id: string;
  template_id: string | null;
  channel: "email" | "whatsapp";
  to_address: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string;
  candidate?: Candidate;
  template?: MessageTemplate;
}

export interface DashboardStats {
  total_candidates: number;
  new_this_week: number;
  interviews_scheduled: number;
  approved_this_month: number;
  pipeline_by_status: { status: string; count: number }[];
  top_jobs: { id: string; title: string; candidate_count: number; top_score: number }[];
  recent_activity: ActivityLog[];
}

export interface CVParseResult {
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  experience_years: number;
  education: string;
  skills: string[];
  certifications: string[];
  previous_roles: PreviousRole[];
}

export interface AIScoreResult {
  score: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: "strong_yes" | "yes" | "maybe" | "no";
}
