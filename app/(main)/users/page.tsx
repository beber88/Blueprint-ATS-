"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, Trash2, Loader2 } from "lucide-react";
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "recruiter" });
  const [inviting, setInviting] = useState(false);

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
    if (!confirm(`${t("common.confirm_delete_user")} ${name}?`)) return;
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(t("common.success"));
    } catch { toast.error(t("common.error")); }
  };

  const inviteUser = async () => {
    if (!inviteForm.email) { toast.error("Email required"); return; }
    setInviting(true);
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(locale === "he" ? "הזמנה נשלחה" : "Invitation sent");
      setInviteOpen(false);
      setInviteForm({ email: "", full_name: "", role: "recruiter" });
      fetch("/api/users").then(r => r.json()).then(setUsers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setInviting(false);
    }
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
          <Shield className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--border-secondary)' }} />
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{l.access_denied}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      <div className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{l.title}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{l.subtitle}</p>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="rounded-lg text-white" style={{ background: 'var(--brand-gold)' }}>
            {locale === "he" ? "הזמן משתמש" : "Invite User"}
          </Button>
        </div>
      </div>
      <div className="px-8 py-6">
        <div className="rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t("common.user")}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{l.role}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{l.joined}</th>
                <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--bg-tertiary)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                        <AvatarFallback className="bg-[color:var(--bg-tertiary)] text-[color:var(--text-gold)] text-xs font-semibold">
                          {(u.full_name || u.email)?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.full_name || u.email}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{u.email}</p>
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
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>{locale === "he" ? "הזמנת משתמש חדש" : "Invite New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{locale === "he" ? "שם מלא" : "Full Name"}</Label>
              <Input value={inviteForm.full_name} onChange={e => setInviteForm({...inviteForm, full_name: e.target.value})} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>{locale === "he" ? "אימייל" : "Email"}</Label>
              <Input type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>{locale === "he" ? "תפקיד" : "Role"}</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm({...inviteForm, role: v})}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{locale === "he" ? "מנהל מערכת" : "Admin"}</SelectItem>
                  <SelectItem value="recruiter">{locale === "he" ? "מגייס" : "Recruiter"}</SelectItem>
                  <SelectItem value="viewer">{locale === "he" ? "צופה" : "Viewer"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="rounded-lg">{locale === "he" ? "ביטול" : "Cancel"}</Button>
            <Button onClick={inviteUser} disabled={inviting} className="rounded-lg text-white" style={{ background: 'var(--brand-gold)' }}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : (locale === "he" ? "שלח הזמנה" : "Send Invite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
