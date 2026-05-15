import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

// ═══════════════════════════════════════
// ROLE HIERARCHY & MODULE ACCESS
// ═══════════════════════════════════════

export type Role = "admin" | "hr" | "user";
export type Module = "recruitment" | "operations" | "contracts" | "hr-management" | "admin";
export type Permission = "view_salary" | "view_emails" | "manage_users" | "export_data" | "delete_candidates" | "write_recruitment";

const ROLE_LEVEL: Record<Role, number> = {
  admin: 100,
  hr: 50,
  user: 10,
};

const ROLE_MODULES: Record<Role, Module[]> = {
  admin: ["recruitment", "operations", "contracts", "hr-management", "admin"],
  hr: ["recruitment", "hr-management"],
  user: ["recruitment"],
};

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ["view_salary", "view_emails", "manage_users", "export_data", "delete_candidates", "write_recruitment"],
  hr: ["view_salary", "view_emails", "write_recruitment", "delete_candidates"],
  user: [],
};

// ═══════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Get the authenticated identity or throw.
 * Works for queries, mutations, and actions.
 */
export async function requireAuth(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

/**
 * Get the authenticated user's profile from the DB.
 * Uses tokenIdentifier as the canonical key, falls back to email lookup.
 * Auto-populates tokenIdentifier on first use.
 */
export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);

  // Try tokenIdentifier first (canonical)
  let profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .first();

  if (profile) {
    return { identity, profile };
  }

  // Fallback: look up by email (for existing profiles pre-migration)
  if (identity.email) {
    profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (profile && !profile.tokenIdentifier) {
      // Backfill tokenIdentifier on first authenticated access
      await ctx.db.patch(profile._id, {
        tokenIdentifier: identity.tokenIdentifier,
        updated_at: Date.now(),
      });
    }
  }

  if (!profile) {
    throw new Error("User profile not found. Please contact an administrator.");
  }

  return { identity, profile };
}

/**
 * Require a minimum role level.
 * Role hierarchy: admin(100) > hr(50) > user(10)
 */
export async function requireRole(ctx: QueryCtx | MutationCtx, minimumRole: Role) {
  const { identity, profile } = await getAuthenticatedUser(ctx);
  const userLevel = ROLE_LEVEL[profile.role as Role] ?? 0;
  const requiredLevel = ROLE_LEVEL[minimumRole];

  if (userLevel < requiredLevel) {
    throw new Error(`Forbidden: requires ${minimumRole} role or higher`);
  }

  return { identity, profile };
}

/**
 * Require access to a specific module.
 */
export async function requireModule(ctx: QueryCtx | MutationCtx, module: Module) {
  const { identity, profile } = await getAuthenticatedUser(ctx);
  const role = profile.role as Role;
  const allowedModules = ROLE_MODULES[role] ?? [];

  if (!allowedModules.includes(module)) {
    throw new Error(`Access denied: no access to ${module} module`);
  }

  return { identity, profile };
}

/**
 * Require a specific permission.
 */
export async function requirePermission(ctx: QueryCtx | MutationCtx, permission: Permission) {
  const { identity, profile } = await getAuthenticatedUser(ctx);
  const role = profile.role as Role;
  const allowed = ROLE_PERMISSIONS[role] ?? [];

  if (!allowed.includes(permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }

  return { identity, profile };
}

/**
 * Check if authenticated user has write access to a module.
 * user role is read-only for recruitment.
 */
export async function requireWriteAccess(ctx: QueryCtx | MutationCtx, module: Module) {
  const { identity, profile } = await requireModule(ctx, module);
  const role = profile.role as Role;

  // user role is read-only on recruitment
  if (role === "user" && module === "recruitment") {
    throw new Error("Access denied: read-only access to recruitment");
  }

  return { identity, profile };
}

/**
 * Get the user's role for conditional logic (without throwing).
 * Returns null if not authenticated.
 */
export async function getOptionalUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  let profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier)
    )
    .first();

  if (!profile && identity.email) {
    profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();
  }

  if (!profile) return null;

  return { identity, profile };
}

// Re-export types and constants for use in other files
export { ROLE_LEVEL, ROLE_MODULES, ROLE_PERMISSIONS };
