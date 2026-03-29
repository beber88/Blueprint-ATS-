"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface UserItem {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at: string;
}

export default function UsersPage() {
  const { user: currentUser, isAdmin } = useUser();
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<UserItem[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/users").then(r => r.json()).then(setUsers).catch(console.error);
  }, [isAdmin]);

  const changeRole = async (id: string, role: string) => {
    try {
      await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: role as "admin" | "user" } : u));
      toast.success(t("common.success"));
    } catch { toast.error(t("common.error")); }
  };

  const removeUser = async (id: string, name: string) => {
    if (!confirm(locale === "he" ? `למחוק את ${name}?` : `Delete ${name}?`)) return;
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(t("common.success"));
    } catch { toast.error(t("common.error")); }
  };

  const labels = {
    he: { title: "ניהול משתמשים", subtitle: "ניהול הרשאות וגישה", access_denied: "אין לך הרשאה לדף זה", admin: "מנהל", user_role: "משתמש", role: "תפקיד", joined: "הצטרף", remove: "הסר" },
    en: { title: "User Management", subtitle: "Manage permissions and access", access_denied: "You don't have permission to view this page", admin: "Admin", user_role: "User", role: "Role", joined: "Joined", remove: "Remove" },
    tl: { title: "Pamamahala ng User", subtitle: "Pamahalaan ang mga permiso at access", access_denied: "Wala kang permiso na tingnan ang pahinang ito", admin: "Admin", user_role: "User", role: "Role", joined: "Sumali", remove: "Alisin" },
  };
  const l = labels[locale] || labels.he;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--gray-300)' }} />
          <p className="text-lg font-semibold" style={{ color: 'var(--navy)' }}>{l.access_denied}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gray-50)' }}>
      <div className="bg-white dark:bg-slate-800 border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>{l.title}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{l.subtitle}</p>
        </div>
      </div>
      <div className="px-8 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--gray-400)' }}>{locale === "he" ? "משתמש" : "User"}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--gray-400)' }}>{l.role}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--gray-400)' }}>{l.joined}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--gray-400)' }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                          {(u.full_name || u.email)?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--navy)' }}>{u.full_name || u.email}</p>
                        <p className="text-xs" style={{ color: 'var(--gray-400)' }}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)} disabled={u.id === currentUser?.id}>
                      <SelectTrigger className="w-32 rounded-lg h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{l.admin}</SelectItem>
                        <SelectItem value="user">{l.user_role}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--gray-400)' }}>
                    {new Date(u.created_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== currentUser?.id && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeUser(u.id, u.full_name || u.email)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
