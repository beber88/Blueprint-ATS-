import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export type Role = "admin" | "hr" | "user";
export type Module = "recruitment" | "operations" | "contracts" | "hr-management" | "admin";
export type Permission = "view_salary" | "view_emails" | "manage_users" | "export_data";

// ═══════════════════════════════════════
// ROLE HIERARCHY & ACCESS MAPS
// ═══════════════════════════════════════

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
  admin: ["view_salary", "view_emails", "manage_users", "export_data"],
  hr: ["view_salary", "view_emails"],
  user: [],
};

// ═══════════════════════════════════════
// MAIN AUTH HELPER
// ═══════════════════════════════════════

interface AuthOptions {
  module?: Module;
  permission?: Permission;
  minimumRole?: Role;
}

interface AuthSuccess {
  error: null;
  user: { id: string; email?: string };
  profile: { id: string; role: Role; full_name: string | null; email: string };
}

interface AuthFailure {
  error: NextResponse;
  user: null;
  profile: null;
}

export async function requireApiAuth(
  options?: AuthOptions
): Promise<AuthSuccess | AuthFailure> {
  // 1. Verify Supabase session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      profile: null,
    };
  }

  // 2. Get user profile with role
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      error: NextResponse.json(
        { error: "User profile not found" },
        { status: 403 }
      ),
      user: null,
      profile: null,
    };
  }

  const role = (profile.role as Role) || "user";

  // 3. Check minimum role
  if (options?.minimumRole) {
    const userLevel = ROLE_LEVEL[role] ?? 0;
    const requiredLevel = ROLE_LEVEL[options.minimumRole] ?? 999;
    if (userLevel < requiredLevel) {
      return {
        error: NextResponse.json(
          { error: "Forbidden: insufficient role" },
          { status: 403 }
        ),
        user: null,
        profile: null,
      };
    }
  }

  // 4. Check module access
  if (options?.module) {
    const allowedModules = ROLE_MODULES[role] ?? [];
    if (!allowedModules.includes(options.module)) {
      return {
        error: NextResponse.json(
          { error: `Forbidden: no access to ${options.module}` },
          { status: 403 }
        ),
        user: null,
        profile: null,
      };
    }
  }

  // 5. Check specific permission
  if (options?.permission) {
    const allowedPermissions = ROLE_PERMISSIONS[role] ?? [];
    if (!allowedPermissions.includes(options.permission)) {
      return {
        error: NextResponse.json(
          { error: `Forbidden: missing permission ${options.permission}` },
          { status: 403 }
        ),
        user: null,
        profile: null,
      };
    }
  }

  return {
    error: null,
    user: { id: user.id, email: user.email },
    profile: { id: profile.id, role, full_name: profile.full_name, email: profile.email },
  };
}
