"use client";

import { useUser } from "@/lib/auth/context";
import { Module, Permission } from "@/lib/auth/permissions";
import { ReactNode } from "react";
import { ShieldX } from "lucide-react";

interface RequireModuleProps {
  module: Module;
  children: ReactNode;
  fallback?: ReactNode;
}

interface RequireRoleProps {
  role: "admin" | "hr";
  children: ReactNode;
  fallback?: ReactNode;
}

interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

function AccessDenied() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 400,
        gap: 16,
        color: "#8A8A8A",
      }}
    >
      <ShieldX style={{ width: 48, height: 48, color: "#C9A84C", opacity: 0.5 }} />
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
        Access Denied
      </h2>
      <p style={{ fontSize: 14, margin: 0, textAlign: "center", maxWidth: 400 }}>
        You don&apos;t have permission to access this page. Contact your administrator to request access.
      </p>
    </div>
  );
}

export function RequireModule({ module, children, fallback }: RequireModuleProps) {
  const { hasModule, loading } = useUser();

  if (loading) return null;
  if (!hasModule(module)) return <>{fallback ?? <AccessDenied />}</>;
  return <>{children}</>;
}

export function RequireRole({ role, children, fallback }: RequireRoleProps) {
  const { user, loading, isAdmin, isHR } = useUser();

  if (loading) return null;
  if (!user) return <>{fallback ?? <AccessDenied />}</>;

  if (role === "admin" && !isAdmin) return <>{fallback ?? <AccessDenied />}</>;
  if (role === "hr" && !isHR) return <>{fallback ?? <AccessDenied />}</>;

  return <>{children}</>;
}

export function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  const { hasPerm, loading } = useUser();

  if (loading) return null;
  if (!hasPerm(permission)) return <>{fallback ?? <AccessDenied />}</>;
  return <>{children}</>;
}
