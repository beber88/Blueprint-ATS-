"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Role, Module, Permission, hasModuleAccess, hasPermission } from "./permissions";

export interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
}

interface UserContextType {
  user: UserData | null;
  loading: boolean;
  isAdmin: boolean;
  isHR: boolean;
  hasModule: (module: Module) => boolean;
  hasPerm: (permission: Permission) => boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const role: Role = user?.role ?? "user";

  const hasModule = useCallback(
    (module: Module) => hasModuleAccess(role, module),
    [role]
  );

  const hasPerm = useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role]
  );

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        isAdmin: role === "admin",
        isHR: role === "hr" || role === "admin",
        hasModule,
        hasPerm,
        refreshUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
