"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { TableLoading } from "@/components/shared/loading";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Search, Plus, MoreHorizontal, Eye, Users,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Candidate } from "@/types";
import { toast } from "sonner";
import { getStatusLabel } from "@/lib/utils";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [manualOpen, setManualOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualForm, setManualForm] = useState({
    full_name: "", email: "", phone: "", location: "", notes: "",
  });

  const [jobs, setJobs] = useState<{id: string; title: string; status: string}[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/jobs").then(r => r.json()).then(setJobs).catch(() => {});
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (selectedJob !== "all") params.set("jobId", selectedJob);
      const res = await fetch(`/api/candidates?${params}`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      toast.error("שגיאה בטעינת מועמדים");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, selectedJob]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress("מעלה ומנתח קו״ח עם AI...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ההעלאה נכשלה");
      } else {
        toast.success(`קו״ח הועלה! ${data.candidate.full_name} נוסף/ה.`);
        fetchCandidates();
      }
    } catch (err) {
      toast.error("שגיאת רשת: " + (err instanceof Error ? err.message : "בדקו את החיבור ונסו שוב."));
    } finally {
      setUploading(false);
      setUploadProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleManualCreate = async () => {
    if (!manualForm.full_name) {
      toast.error("שם הוא שדה חובה");
      return;
    }
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("המועמד/ת נוצר/ה!");
      setManualOpen(false);
      setManualForm({ full_name: "", email: "", phone: "", location: "", notes: "" });
      fetchCandidates();
    } catch {
      toast.error("שגיאה ביצירת מועמד/ת");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`/api/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success("הסטטוס עודכן");
      fetchCandidates();
    } catch {
      toast.error("שגיאה בעדכון סטטוס");
    }
  };

  const statuses = [
    "new", "reviewed", "shortlisted", "interview_scheduled",
    "interviewed", "approved", "rejected", "keep_for_future",
  ];

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getTopScore = (candidate: Candidate & { applications?: { ai_score: number | null }[] }) => {
    const apps = candidate.applications || [];
    const scores = apps.map((a) => a.ai_score).filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.max(...scores) : null;
  };

  const avatarColors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
  ];

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--gray-50)' }}>
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />

      {/* Page Header */}
      <div className="bg-white border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>מועמדים</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>סה״כ {candidates.length} מועמדים</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setManualOpen(true)} className="rounded-lg">
              <Plus className="ml-2 h-4 w-4" /> הוסף ידנית
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} className="rounded-lg text-white" style={{ background: 'var(--blue)' }}>
              <Upload className="ml-2 h-4 w-4" /> העלה קורות חיים
            </Button>
          </div>
        </div>

        {/* Job Filter Tabs */}
        <div className="px-8 pb-0 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setSelectedJob("all")}
            className="px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors"
            style={selectedJob === "all" ? { background: 'var(--blue)', color: '#fff' } : { color: 'var(--gray-600)', background: 'var(--gray-100)' }}
          >
            הכל
          </button>
          {jobs.filter(j => j.status === "active").map(job => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job.id)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors"
              style={selectedJob === job.id ? { background: 'var(--blue)', color: '#fff' } : { color: 'var(--gray-600)', background: 'var(--gray-100)' }}
            >
              {job.title}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--gray-400)' }} />
          <Input
            placeholder="חיפוש לפי שם, מייל, כישורים..."
            className="pr-10 h-11 rounded-lg"
            style={{ borderColor: 'var(--gray-200)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 rounded-lg h-9 text-sm" style={{ borderColor: 'var(--gray-200)' }}>
              <SelectValue placeholder="סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          {(statusFilter !== "all" || selectedJob !== "all") && (
            <button onClick={() => { setStatusFilter("all"); setSelectedJob("all"); }} className="text-sm font-medium" style={{ color: 'var(--blue)' }}>
              נקה הכל
            </button>
          )}
        </div>

        {/* Candidates Table */}
        {loading ? <TableLoading rows={8} /> : candidates.length === 0 ? (
          <div className="bg-white rounded-xl p-16 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--gray-100)' }}>
              <Users className="h-8 w-8" style={{ color: 'var(--gray-400)' }} />
            </div>
            <p className="font-semibold text-lg" style={{ color: 'var(--navy)' }}>אין מועמדים עדיין</p>
            <p className="text-sm mt-1 mb-4" style={{ color: 'var(--gray-400)' }}>העלו קורות חיים ראשונים כדי להתחיל</p>
            <Button onClick={() => fileInputRef.current?.click()} className="rounded-lg text-white" style={{ background: 'var(--blue)' }}>
              <Upload className="ml-2 h-4 w-4" /> העלה קורות חיים
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>
                    <input type="checkbox" className="rounded" onChange={(e) => {
                      if (e.target.checked) setSelectedRows(new Set(candidates.map(c => c.id)));
                      else setSelectedRows(new Set());
                    }} />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>מועמד</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>משרה</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>סטטוס</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>ציון AI</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>ניסיון</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--gray-400)' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => {
                  const topScore = getTopScore(candidate as Candidate & { applications?: { ai_score: number | null }[] });
                  const jobApp = (candidate as Candidate & { applications?: { job?: { title: string } }[] }).applications?.[0];
                  const jobTitle = jobApp?.job?.title;
                  return (
                    <tr key={candidate.id} className="hover:bg-slate-50/50 transition-colors" style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded" checked={selectedRows.has(candidate.id)}
                          onChange={(e) => {
                            const next = new Set(selectedRows);
                            if (e.target.checked) next.add(candidate.id); else next.delete(candidate.id);
                            setSelectedRows(next);
                          }} />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/candidates/${candidate.id}`} className="flex items-center gap-3 group">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={getAvatarColor(candidate.full_name) + " font-semibold text-sm"}>
                              {getInitials(candidate.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold group-hover:text-blue-600 transition-colors" style={{ color: 'var(--navy)' }}>{candidate.full_name}</p>
                            {candidate.email && <p className="text-xs" style={{ color: 'var(--gray-400)' }}>{candidate.email}</p>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {jobTitle ? (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-md" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>{jobTitle}</span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--gray-400)' }}>לא משויך</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={candidate.status} /></td>
                      <td className="px-4 py-3">
                        {topScore !== null ? <ScoreBadge score={topScore} size="sm" /> : <span className="text-xs" style={{ color: 'var(--gray-400)' }}>--</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--gray-600)' }}>
                          {candidate.experience_years ? `${candidate.experience_years} שנים` : "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-lg">
                            <DropdownMenuItem asChild>
                              <Link href={`/candidates/${candidate.id}`}><Eye className="ml-2 h-4 w-4" /> צפה בפרופיל</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {statuses.map(s => (
                              <DropdownMenuItem key={s} onClick={() => handleStatusChange(candidate.id, s)} disabled={candidate.status === s}>
                                {getStatusLabel(s)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedRows.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--navy)', boxShadow: 'var(--shadow-md)', zIndex: 50 }}>
            <span>{selectedRows.size} נבחרו</span>
            <button className="px-3 py-1 rounded-md text-xs" style={{ background: 'rgba(255,255,255,0.15)' }}>שנה סטטוס</button>
            <button onClick={() => setSelectedRows(new Set())} className="px-3 py-1 rounded-md text-xs" style={{ background: 'rgba(255,255,255,0.1)' }}>בטל בחירה</button>
          </div>
        )}
      </div>

      {/* Upload progress dialog */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-xl p-8 text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
            <div className="h-8 w-8 border-3 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--gray-200)', borderTopColor: 'var(--blue)' }} />
            <p className="font-medium" style={{ color: 'var(--navy)' }}>{uploadProgress || "מעלה ומנתח קו״ח עם AI..."}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--gray-400)' }}>זה עשוי לקחת מספר שניות</p>
          </div>
        </div>
      )}

      {/* Manual Create Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-900">הוספת מועמד ידנית</DialogTitle>
            <p className="text-sm text-slate-500 mt-1">מלאו את הפרטים ליצירת רשומת מועמד חדשה</p>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">שם מלא <span className="text-red-500">*</span></Label>
              <Input
                value={manualForm.full_name}
                onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })}
                placeholder="ישראל ישראלי"
                className="h-11 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">אימייל</Label>
                <Input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">טלפון</Label>
                <Input
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  placeholder="050-0000000"
                  className="h-11 rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">מיקום</Label>
              <Input
                value={manualForm.location}
                onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })}
                placeholder="תל אביב"
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">הערות</Label>
              <Textarea
                value={manualForm.notes}
                onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                placeholder="הערות נוספות על המועמד/ת..."
                rows={3}
                className="resize-none rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setManualOpen(false)}
              className="rounded-lg"
            >
              ביטול
            </Button>
            <Button
              onClick={handleManualCreate}
              className="rounded-lg bg-electric-600 hover:bg-electric-700"
            >
              יצירת מועמד
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
