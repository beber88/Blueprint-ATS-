export type Role = "admin" | "hr" | "user";
export type Module = "recruitment" | "operations" | "contracts" | "hr-management" | "admin";
export type Permission =
  | "view_salary"
  | "view_emails"
  | "manage_users"
  | "export_data"
  | "delete_candidates"
  | "write_recruitment";

// ═══════════════════════════════════════
// ROLE → MODULE ACCESS
// ═══════════════════════════════════════

export const ROLE_MODULES: Record<Role, Module[]> = {
  admin: ["recruitment", "operations", "contracts", "hr-management", "admin"],
  hr: ["recruitment", "hr-management"],
  user: ["recruitment"],
};

// ═══════════════════════════════════════
// ROLE → PERMISSIONS
// ═══════════════════════════════════════

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ["view_salary", "view_emails", "manage_users", "export_data", "delete_candidates", "write_recruitment"],
  hr: ["view_salary", "view_emails", "write_recruitment", "delete_candidates"],
  user: [],
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

export function hasModuleAccess(role: Role, module: Module): boolean {
  return (ROLE_MODULES[role] ?? []).includes(module);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export function can(role: Role, permission: Permission): boolean {
  return hasPermission(role, permission);
}
