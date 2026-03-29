"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BOARDS = [
  { key: "jobstreet", name: "JobStreet", fields: [{ key: "api_key", label: "API Key" }, { key: "api_secret", label: "API Secret" }] },
  { key: "kalibrr", name: "Kalibrr", fields: [{ key: "api_token", label: "API Token" }, { key: "company_id", label: "Company ID" }] },
  { key: "indeed", name: "Indeed", fields: [{ key: "publisher_id", label: "Publisher ID" }, { key: "api_key", label: "API Key" }] },
  { key: "linkedin", name: "LinkedIn", fields: [{ key: "client_id", label: "Client ID" }, { key: "client_secret", label: "Client Secret" }, { key: "access_token", label: "Access Token" }] },
  { key: "onlinejobs", name: "OnlineJobs.ph", fields: [{ key: "username", label: "Username" }, { key: "password", label: "Password" }] },
];

export default function JobBoardsPage() {
  const { locale } = useI18n();
  useUser(); // ensure auth context
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({});
  const [editingBoard, setEditingBoard] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/job-boards/credentials").then(r => r.json()).then(setCredentials).catch(console.error);
  }, []);

  const saveCredentials = async (boardKey: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/job-boards/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: boardKey, credentials: formData }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(locale === "he" ? "נשמר בהצלחה" : "Saved successfully");
      setEditingBoard(null);
      // Refresh
      const updated = await fetch("/api/job-boards/credentials").then(r => r.json());
      setCredentials(updated);
    } catch {
      toast.error(locale === "he" ? "שגיאה בשמירה" : "Save error");
    } finally {
      setSaving(false);
    }
  };

  const labels = {
    he: { title: "לוחות דרושים", subtitle: "חיבור ללוחות דרושים לפרסום משרות", connected: "מחובר", not_connected: "לא מחובר", save: "שמור", cancel: "ביטול", edit: "ערוך", webhook: "Webhook URL" },
    en: { title: "Job Boards", subtitle: "Connect to job boards for posting jobs", connected: "Connected", not_connected: "Not Connected", save: "Save", cancel: "Cancel", edit: "Edit", webhook: "Webhook URL" },
    tl: { title: "Mga Job Board", subtitle: "Kumonekta sa mga job board", connected: "Nakakonekta", not_connected: "Hindi nakakonekta", save: "I-save", cancel: "Kanselahin", edit: "I-edit", webhook: "Webhook URL" },
  };
  const l = labels[locale] || labels.he;

  return (
    <div className="min-h-screen" style={{ background: 'var(--gray-50)' }}>
      <div className="bg-white dark:bg-slate-800 border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>{l.title}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{l.subtitle}</p>
        </div>
      </div>
      <div className="px-8 py-6 max-w-4xl space-y-4">
        {BOARDS.map(board => {
          const boardCreds = credentials[board.key] || {};
          const isConnected = Object.values(boardCreds).some(v => v && v.length > 4);
          const isEditing = editingBoard === board.key;

          return (
            <div key={board.key} className="bg-white dark:bg-slate-800 rounded-xl p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
                    {board.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold" style={{ color: 'var(--navy)' }}>{board.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isConnected ? (
                        <><CheckCircle className="h-3.5 w-3.5" style={{ color: 'var(--green)' }} /><span className="text-xs font-medium" style={{ color: 'var(--green)' }}>{l.connected}</span></>
                      ) : (
                        <><XCircle className="h-3.5 w-3.5" style={{ color: 'var(--gray-400)' }} /><span className="text-xs" style={{ color: 'var(--gray-400)' }}>{l.not_connected}</span></>
                      )}
                    </div>
                  </div>
                </div>
                {!isEditing && (
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setEditingBoard(board.key); setFormData({}); }}>
                    {l.edit}
                  </Button>
                )}
              </div>

              {isEditing && (
                <div className="space-y-3 pt-2">
                  {board.fields.map(field => (
                    <div key={field.key} className="space-y-1">
                      <Label className="text-sm">{field.label}</Label>
                      <Input
                        type={field.key.includes("password") || field.key.includes("secret") || field.key.includes("token") ? "password" : "text"}
                        value={formData[field.key] || ""}
                        onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="rounded-lg"
                        placeholder={boardCreds[field.key] || ""}
                      />
                    </div>
                  ))}
                  <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--gray-50)', color: 'var(--gray-400)' }}>
                    <strong>{l.webhook}:</strong> https://blueprint-ats.vercel.app/api/webhooks/{board.key}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setEditingBoard(null)}>{l.cancel}</Button>
                    <Button size="sm" className="rounded-lg text-white" style={{ background: 'var(--blue)' }} disabled={saving} onClick={() => saveCredentials(board.key)}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : l.save}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
