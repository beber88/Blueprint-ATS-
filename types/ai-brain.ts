export type InsightType =
  | "cost_saving"
  | "performance_alert"
  | "efficiency_tip"
  | "strategic"
  | "risk_alert"
  | "attendance_pattern"
  | "training_gap"
  | "turnover_risk";

export type InsightSeverity = "info" | "warning" | "critical";
export type InsightStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export interface BrainInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  recommendation: string | null;
  affected_employees: string[];
  department_id: string | null;
  data_snapshot: Record<string, unknown>;
  status: InsightStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  // Joined fields
  department_name?: string;
  affected_employee_names?: string[];
}

export interface ScoreBreakdown {
  attendance: number;
  performance: number;
  training: number;
  leave_health: number;
  operations: number;
}

export interface BrainScore {
  id: string;
  scope: "company" | "department" | "employee";
  scope_id: string | null;
  score: number;
  breakdown: ScoreBreakdown;
  computed_at: string;
  scope_name?: string;
}

export type RiskFactor =
  | "frequent_absence"
  | "low_performance"
  | "overdue_review"
  | "incomplete_training"
  | "high_leave_usage"
  | "declining_trend";

export interface EmployeeRisk {
  employee_id: string;
  full_name: string;
  department_name: string;
  risk_score: number;
  risk_factors: RiskFactor[];
}

export interface ComputedMetrics {
  company_health: number;
  attendance_rate: number;
  training_compliance: number;
  avg_performance: number;
  active_insights_count: number;
  critical_count: number;
  at_risk_count: number;
  department_scores: Array<{ id: string; name: string; score: number; breakdown: ScoreBreakdown }>;
  employee_risks: EmployeeRisk[];
  trends: {
    attendance_30d: Array<{ date: string; rate: number }>;
    overtime_30d: Array<{ date: string; hours: number }>;
  };
}
