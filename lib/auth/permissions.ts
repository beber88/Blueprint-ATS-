export type Role = "admin" | "recruiter" | "viewer" | "user";

export const PERMISSIONS = {
  admin: {
    can_manage_users: true, can_delete_candidates: true, can_change_any_status: true,
    can_post_jobs: true, can_manage_job_boards: true, can_view_all: true,
    can_manage_templates: true, can_export_data: true,
    can_manage_employees: true, can_view_salary: true, can_manage_payroll: true,
    can_manage_compliance: true, can_view_reports: true, can_manage_drive_sync: true,
  },
  recruiter: {
    can_manage_users: false, can_delete_candidates: false, can_change_any_status: true,
    can_post_jobs: true, can_manage_job_boards: true, can_view_all: true,
    can_manage_templates: true, can_export_data: false,
    can_manage_employees: false, can_view_salary: false, can_manage_payroll: false,
    can_manage_compliance: false, can_view_reports: true, can_manage_drive_sync: false,
  },
  user: {
    can_manage_users: false, can_delete_candidates: false, can_change_any_status: true,
    can_post_jobs: true, can_manage_job_boards: false, can_view_all: true,
    can_manage_templates: false, can_export_data: false,
    can_manage_employees: true, can_view_salary: false, can_manage_payroll: false,
    can_manage_compliance: false, can_view_reports: true, can_manage_drive_sync: false,
  },
  viewer: {
    can_manage_users: false, can_delete_candidates: false, can_change_any_status: false,
    can_post_jobs: false, can_manage_job_boards: false, can_view_all: true,
    can_manage_templates: false, can_export_data: false,
    can_manage_employees: false, can_view_salary: false, can_manage_payroll: false,
    can_manage_compliance: false, can_view_reports: false, can_manage_drive_sync: false,
  },
} as const;

export function can(role: Role, permission: keyof typeof PERMISSIONS.admin): boolean {
  return PERMISSIONS[role]?.[permission] ?? false;
}
