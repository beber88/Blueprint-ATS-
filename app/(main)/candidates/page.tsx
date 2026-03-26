"use client";

import { useEffect, useState, useCallback } from "react";
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
  Upload, Search, Plus, MoreHorizontal, Eye, Users, FileUp, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Candidate } from "@/types";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [manualForm, setManualForm] = useState({
    full_name: "", email: "", phone: "", location: "", notes: "",
  });

  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/candidates?${params}`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      toast.error("שגיאה בטעינת מועמדים");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Reset file input so same file can be re-uploaded
    e.target.value = "";

    const totalFiles = files.length;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      setUploadProgress(
        totalFiles > 1 ? `מעלה ${i + 1}/${totalFiles} קו״ח...` : "מעלה ומנתח קו״ח עם AI..."
      );

      const formData = new FormData();
      formData.append("file", files[i]);

      try {
        const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          failCount++;
          if (totalFiles === 1) {
            toast.error(data.error || "ההעלאה נכשלה");
          }
        } else {
          successCount++;
          if (totalFiles === 1) {
            toast.success(`קו״ח הועלה! ${data.candidate.full_name} נוסף/ה.`);
          }
        }
      } catch {
        failCount++;
        if (totalFiles === 1) {
          toast.error("שגיאת רשת. בדקו את החיבור ונסו שוב.");
        }
      }
    }

    if (totalFiles > 1) {
      if (failCount === 0) {
        toast.success(`הועלו ${successCount}/${totalFiles} קו״ח בהצלחה`);
      } else {
        toast.warning(`הועלו ${successCount}/${totalFiles} קו״ח בהצלחה, ${failCount} נכשלו`);
      }
    }

    setUploadProgress("");
    setUploading(false);
    if (successCount > 0) {
      setUploadOpen(false);
      fetchCandidates();
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
    <div className="min-h-screen bg-slate-50/50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-electric-500 to-electric-600 shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">מועמדים</h1>
                  <span className="inline-flex items-center justify-center rounded-full bg-electric-50 text-electric-700 border border-electric-200 px-3 py-0.5 text-sm font-semibold tabular-nums min-w-[2rem]">
                    {candidates.length}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">ניהול וצפייה בכל המועמדים במערכת</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setManualOpen(true)}
                className="h-10 px-4 rounded-lg border-slate-200 shadow-sm hover:shadow-md transition-all"
              >
                <Plus className="ml-2 h-4 w-4" />
                הוספה ידנית
              </Button>
              <Button
                onClick={() => setUploadOpen(true)}
                className="h-10 px-5 rounded-lg shadow-sm hover:shadow-md transition-all bg-electric-600 hover:bg-electric-700"
              >
                <Upload className="ml-2 h-4 w-4" />
                העלאת קו״ח
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {/* Full-width Search Bar */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            placeholder="חיפוש לפי שם, אימייל או כישורים..."
            className="pr-12 h-12 bg-white border-slate-200 rounded-xl shadow-sm text-base placeholder:text-slate-400 focus:ring-2 focus:ring-electric-500/20 focus:border-electric-400 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-56 h-10 bg-white border-slate-200 rounded-lg shadow-sm text-sm hover:border-slate-300 transition-colors">
              <SelectValue placeholder="סינון לפי סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="text-sm text-slate-500 hover:text-slate-700 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              נקה סינון
            </Button>
          )}
        </div>

        {/* Candidates Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6">
              <TableLoading rows={8} />
            </div>
          </div>
        ) : candidates.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-sm">
            <div className="py-20 px-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 mb-5">
                <Users className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">לא נמצאו מועמדים</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                התחילו על ידי העלאת קורות חיים או הוספת מועמד ידנית למערכת
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setManualOpen(true)}
                  className="h-10 px-5 rounded-lg"
                >
                  <Plus className="ml-2 h-4 w-4" />
                  הוספה ידנית
                </Button>
                <Button
                  onClick={() => setUploadOpen(true)}
                  className="h-10 px-5 rounded-lg bg-electric-600 hover:bg-electric-700"
                >
                  <Upload className="ml-2 h-4 w-4" />
                  העלאת קו״ח
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Candidates Table Card */
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[3fr_1fr_1fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3.5 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">מועמד</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">סטטוס</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">ציון AI</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">כישורים</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">ניסיון</span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">תאריך הוספה</span>
              <span className="w-10" />
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {candidates.map((candidate) => {
                const topScore = getTopScore(candidate as Candidate & { applications?: { ai_score: number | null }[] });
                const colorClass = getAvatarColor(candidate.full_name);
                return (
                  <div
                    key={candidate.id}
                    className="group grid grid-cols-1 md:grid-cols-[3fr_1fr_1fr_2fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-colors cursor-default"
                  >
                    {/* Name + Avatar */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-white shadow-sm">
                        <AvatarFallback className={`${colorClass} font-semibold text-sm`}>
                          {getInitials(candidate.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="font-semibold text-slate-900 hover:text-electric-600 transition-colors truncate block leading-tight"
                        >
                          {candidate.full_name}
                        </Link>
                        <p className="text-sm text-slate-500 truncate mt-0.5">
                          {candidate.email || candidate.phone || candidate.location || ""}
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <StatusBadge status={candidate.status} />
                    </div>

                    {/* AI Score */}
                    <div>
                      {topScore !== null ? (
                        <ScoreBadge score={topScore} size="sm" />
                      ) : (
                        <span className="text-sm text-slate-300 font-medium">--</span>
                      )}
                    </div>

                    {/* Skills */}
                    <div className="flex gap-1.5 flex-wrap">
                      {candidate.skills && candidate.skills.length > 0 ? (
                        <>
                          {candidate.skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200/60"
                            >
                              {skill}
                            </span>
                          ))}
                          {candidate.skills.length > 3 && (
                            <span className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-400">
                              +{candidate.skills.length - 3}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-slate-300">--</span>
                      )}
                    </div>

                    {/* Experience */}
                    <div>
                      <span className="text-sm text-slate-700 font-medium">
                        {candidate.experience_years != null
                          ? `${candidate.experience_years} שנים`
                          : <span className="text-slate-300">--</span>}
                      </span>
                    </div>

                    {/* Date Added */}
                    <div>
                      <span className="text-sm text-slate-500">
                        {formatDate(candidate.created_at)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-lg shadow-lg border-slate-200">
                          <DropdownMenuItem asChild>
                            <Link href={`/candidates/${candidate.id}`} className="flex items-center">
                              <Eye className="ml-2 h-4 w-4" />
                              צפייה בפרופיל
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {statuses.map((s) => (
                            <DropdownMenuItem
                              key={s}
                              onClick={() => handleStatusChange(candidate.id, s)}
                              disabled={candidate.status === s}
                              className="text-sm"
                            >
                              קבע: {s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent className="sm:max-w-md rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-slate-900">העלאת קו״ח</DialogTitle>
              <p className="text-sm text-slate-500 mt-1">גררו קבצים או לחצו לבחירת קורות חיים</p>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-electric-400 hover:bg-electric-50/30 transition-all duration-200 cursor-pointer relative group">
                <div className="pointer-events-none">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-electric-50 group-hover:bg-electric-100 transition-colors mb-5">
                    <FileUp className="h-8 w-8 text-electric-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1.5">
                    גררו קבצים לכאן, או לחצו לבחירה
                  </p>
                  <p className="text-xs text-slate-400">
                    PDF, DOC, DOCX -- תמיכה במספר קבצים בו-זמנית
                  </p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  multiple
                  onChange={handleUpload}
                  disabled={uploading}
                  className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              {uploading && (
                <div className="flex items-center justify-center gap-3 py-3 bg-electric-50 rounded-lg">
                  <div className="h-5 w-5 border-2 border-electric-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-electric-700">
                    {uploadProgress || "מעלה ומנתח קו״ח עם AI..."}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

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
    </div>
  );
}
