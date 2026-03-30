/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { translateExperience } from "@/lib/i18n/content-translations";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { TableLoading } from "@/components/shared/loading";
import { BulkUpload } from "@/components/shared/bulk-upload";
import { SmartUpload } from "@/components/candidates/smart-upload";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Search, Plus, MoreHorizontal, Eye, Users, Mail, RefreshCw, Briefcase, Trash2, Loader2, Bot, Pencil, Brain,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Candidate } from "@/types";
import { toast } from "sonner";
import { getStatusLabel } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/auth/context";

export default function CandidatesPage() {
  const { t, locale } = useI18n();
  const { isAdmin } = useUser();
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

  const [categories, setCategories] = useState<{key: string; name_he: string; name_en: string; name_tl: string; parent_key: string | null}[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [jobs, setJobs] = useState<{id: string; title: string; status: string}[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>("all");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [smartUploadOpen, setSmartUploadOpen] = useState(false);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [templates, setTemplates] = useState<{id: string; name: string; type: string}[]>([]);
  const [reclassifying, setReclassifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [classifying, setClassifying] = useState(false);

  useEffect(() => {
    fetch("/api/jobs").then(r => r.json()).then(setJobs).catch(() => {});
    fetch("/api/templates").then(r => r.json()).then(setTemplates).catch(() => {});
    fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (selectedJob !== "all") params.set("jobId", selectedJob);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      params.set("limit", "200");
      const res = await fetch(`/api/candidates?${params}`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, selectedJob, categoryFilter]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(t("common.loading"));

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("common.error"));
      } else {
        toast.success(t("candidates.toast.cv_uploaded"));
        fetchCandidates();
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setUploading(false);
      setUploadProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleManualCreate = async () => {
    if (!manualForm.full_name) {
      toast.error(t("common.error"));
      return;
    }
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("candidates.toast.created"));
      setManualOpen(false);
      setManualForm({ full_name: "", email: "", phone: "", location: "", notes: "" });
      fetchCandidates();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`/api/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success(t("candidates.toast.status_updated"));
      fetchCandidates();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleBulkEmail = async () => {
    if (!bulkTemplate) { toast.error(t("common.error")); return; }
    setBulkSending(true);
    const ids = Array.from(selectedRows);
    setBulkProgress(t("common.loading"));
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: ids, templateId: bulkTemplate, channel: "email" }),
      });
      const data = await res.json();
      toast.success(t("candidates.toast.emails_sent"));
      if (data.failed > 0) toast.warning(t("common.error"));
      setSelectedRows(new Set());
      setBulkEmailOpen(false);
      fetchCandidates();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBulkSending(false);
      setBulkProgress("");
    }
  };

  const handleReclassify = async () => {
    setReclassifying(true);
    toast.info(locale === "he" ? "מסווג מועמדים..." : "Classifying candidates...");
    try {
      const res = await fetch("/api/candidates/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(locale === "he"
        ? `סווגו ${data.classified} מועמדים מתוך ${data.total}`
        : `Classified ${data.classified} of ${data.total} candidates`
      );
      fetchCandidates();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setReclassifying(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(locale === "he" ? `למחוק ${selectedRows.size} מועמדים?` : `Delete ${selectedRows.size} candidates?`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/candidates/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_ids: Array.from(selectedRows) }),
      });
      const data = await res.json();
      toast.success(locale === "he" ? `נמחקו ${data.deleted} מועמדים` : `Deleted ${data.deleted} candidates`);
      setSelectedRows(new Set());
      fetchCandidates();
    } catch { toast.error(t("common.error")); }
    finally { setDeleting(false); }
  };

  const handleClassifyProfessions = async () => {
    setClassifying(true);
    toast.info(locale === "he" ? "מסווג מקצועות..." : "Classifying professions...");
    try {
      const res = await fetch("/api/maintenance/classify-professions", { method: "POST" });
      const data = await res.json();
      toast.success(locale === "he" ? `סווגו ${data.classified} מועמדים` : `Classified ${data.classified} candidates`);
      fetchCandidates();
    } catch { toast.error(t("common.error")); }
    finally { setClassifying(false); }
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
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />

      {/* Page Header */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border-primary)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t("candidates.title")}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{candidates.length} {t("candidates.title")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setManualOpen(true)} className="rounded-lg" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
              <Plus className="ml-2 h-4 w-4" /> {t("candidates.add_manual")}
            </Button>
            <Button onClick={() => setSmartUploadOpen(true)} className="rounded-lg" style={{ background: 'var(--brand-gold)', color: '#1A1A1A' }}>
              <Upload className="ml-2 h-4 w-4" /> {t("candidates.upload_cv")}
            </Button>
            <Button onClick={handleReclassify} disabled={reclassifying} variant="outline" className="rounded-lg" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
              <RefreshCw className={`ml-2 h-4 w-4 ${reclassifying ? "animate-spin" : ""}`} />
              {locale === "he" ? "סווג מחדש" : "Reclassify"}
            </Button>
            <Button onClick={handleClassifyProfessions} disabled={classifying} variant="outline" className="rounded-lg text-xs" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
              {classifying ? <Loader2 className="ml-1 h-3 w-3 animate-spin" /> : <Brain className="ml-1 h-3 w-3" />}
              {locale === "he" ? "סווג מקצועות" : "Classify"}
            </Button>
          </div>
        </div>

        {/* Job Filter Tabs */}
        <div className="px-8 pb-0 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setSelectedJob("all")}
            className="px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors"
            style={selectedJob === "all" ? { background: 'var(--brand-gold)', color: '#1A1A1A' } : { color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
          >
            {t("candidates.all_jobs")}
          </button>
          {jobs.filter(j => j.status === "active").map(job => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job.id)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors"
              style={selectedJob === job.id ? { background: 'var(--brand-gold)', color: '#1A1A1A' } : { color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
            >
              {job.title}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          <Input
            placeholder={t("candidates.search_placeholder")}
            className="pr-10 h-11 rounded-lg"
            style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 rounded-lg h-9 text-sm" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <SelectValue placeholder={t("candidates.table.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("candidates.all_statuses")}</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 rounded-lg h-9 text-sm" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <SelectValue placeholder={t("candidates.all_jobs")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all_professions")}</SelectItem>
              {categories.filter(c => !c.parent_key).map(cat => (
                <SelectItem key={cat.key} value={cat.key}>
                  {locale === "he" ? cat.name_he : locale === "tl" ? cat.name_tl : cat.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(statusFilter !== "all" || selectedJob !== "all") && (
            <button onClick={() => { setStatusFilter("all"); setSelectedJob("all"); }} className="text-sm font-medium" style={{ color: 'var(--text-gold)' }}>
              {t("common.clear_filters")}
            </button>
          )}
        </div>

        {/* Candidates Table */}
        {loading ? <TableLoading rows={8} /> : candidates.length === 0 ? (
          <div className="rounded-xl p-16 text-center" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border-primary)' }}>
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-tertiary)' }}>
              <Users className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{t("candidates.no_candidates")}</p>
            <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.upload_first")}</p>
            <Button onClick={() => fileInputRef.current?.click()} className="rounded-lg" style={{ background: 'var(--brand-gold)', color: '#1A1A1A' }}>
              <Upload className="ml-2 h-4 w-4" /> {t("candidates.upload_cv")}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', border: '0.5px solid var(--border-primary)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '0.5px solid var(--border-primary)' }}>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    <input type="checkbox" className="rounded" onChange={(e) => {
                      if (e.target.checked) setSelectedRows(new Set(candidates.map(c => c.id)));
                      else setSelectedRows(new Set());
                    }} />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.table.candidate")}</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t("common.professional_classification")}</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    {locale === "he" ? "מקצוע" : "Profession"}
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.table.status")}</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.table.ai_score")}</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.table.experience")}</th>
                  <th className="text-right px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => {
                  const cand = candidate as Candidate & { applications?: { ai_score: number | null }[]; ai_analysis?: { total_score?: number; verdict?: { score?: number } } };
                  const topScore = getTopScore(cand);
                  const analysisScore = cand.ai_analysis?.total_score || cand.ai_analysis?.verdict?.score || null;
                  const displayScore = topScore ?? analysisScore;
                  const candCategories = (cand as unknown as { job_categories?: string[] }).job_categories || [];
                  return (
                    <tr
                      key={candidate.id}
                      className="transition-colors"
                      style={{ borderBottom: '0.5px solid var(--border-light)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
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
                            <p className="font-semibold transition-colors flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                              {candidate.full_name}
                              {(cand as unknown as { has_portfolio?: boolean }).has_portfolio && (
                                <span title={t("files.has_portfolio")}><Briefcase className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--brand-gold)' }} /></span>
                              )}
                            </p>
                            {candidate.email && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{candidate.email}</p>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {candCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {candCategories.slice(0, 2).map((catKey: string) => {
                              const cat = categories.find(c => c.key === catKey);
                              const name = cat ? (locale === "he" ? cat.name_he : locale === "tl" ? cat.name_tl : cat.name_en) : catKey;
                              return <span key={catKey} className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-gold)' }}>{name}</span>;
                            })}
                            {candCategories.length > 2 && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>+{candCategories.length - 2}</span>}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t("common.not_classified")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(cand as any).profession ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-gold)' }}>
                              {t(`job_categories.${(cand as any).profession}`) || (cand as any).profession}
                            </span>
                            {(cand as any).profession_source === "auto" ? (
                              <Bot className="h-3 w-3" style={{ color: 'var(--text-gold)', opacity: 0.6 }} />
                            ) : (cand as any).profession_source === "manual" ? (
                              <Pencil className="h-3 w-3" style={{ color: 'var(--text-gold)', opacity: 0.6 }} />
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={candidate.status} /></td>
                      <td className="px-4 py-3">
                        {displayScore !== null && displayScore !== undefined ? <ScoreBadge score={displayScore} size="sm" /> : <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>--</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {candidate.experience_years ? translateExperience(candidate.experience_years, locale) : "--"}
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
                              <Link href={`/candidates/${candidate.id}`}><Eye className="ml-2 h-4 w-4" /> {t("candidates.actions.view_profile")}</Link>
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
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-xl text-sm font-medium" style={{ background: '#1A1A1A', color: 'var(--text-primary)', boxShadow: 'var(--shadow-md)', zIndex: 50, border: '0.5px solid var(--border-primary)' }}>
            <span style={{ color: '#FFFFFF' }}>{selectedRows.size} {t("candidates.bulk.selected")}</span>
            <button onClick={() => setBulkEmailOpen(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--brand-gold)', color: '#1A1A1A' }}>
              <Mail className="inline h-3 w-3 ml-1" /> {t("candidates.bulk.send_email")}
            </button>
            {isAdmin && (
              <button onClick={handleBulkDelete} disabled={deleting} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--status-rejected-bg)', color: 'var(--status-rejected-text)' }}>
                {deleting ? <Loader2 className="inline h-3 w-3 animate-spin ml-1" /> : <Trash2 className="inline h-3 w-3 ml-1" />}
                {locale === "he" ? "מחק" : "Delete"}
              </button>
            )}
            <button className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}>{t("candidates.bulk.change_status")}</button>
            <button onClick={() => setSelectedRows(new Set())} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }}>{t("candidates.bulk.cancel")}</button>
          </div>
        )}
      </div>

      {/* Upload progress dialog */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)', border: '0.5px solid var(--border-primary)' }}>
            <div className="h-8 w-8 border-3 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--border-light)', borderTopColor: 'var(--brand-gold)' }} />
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{uploadProgress || t("common.loading")}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{t("common.loading")}</p>
          </div>
        </div>
      )}

      {/* Manual Create Dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{t("candidates.add_manual")}</DialogTitle>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.add_manual_description")}</p>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t("candidates.form.full_name")} <span className="text-red-500">*</span></Label>
              <Input
                value={manualForm.full_name}
                onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })}
                placeholder="John Doe"
                className="h-11 rounded-lg"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t("candidates.form.email")}</Label>
                <Input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="h-11 rounded-lg"
                  style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t("candidates.form.phone")}</Label>
                <Input
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  placeholder="050-0000000"
                  className="h-11 rounded-lg"
                  style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t("candidates.form.location")}</Label>
              <Input
                value={manualForm.location}
                onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })}
                placeholder="Tel Aviv"
                className="h-11 rounded-lg"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t("interviews.form.notes")}</Label>
              <Textarea
                value={manualForm.notes}
                onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                placeholder={t("interviews.form.notes")}
                rows={3}
                className="resize-none rounded-lg"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <DialogFooter className="gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setManualOpen(false)}
              className="rounded-lg"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleManualCreate}
              className="rounded-lg"
              style={{ background: 'var(--brand-gold)', color: '#1A1A1A' }}
            >
              {t("candidates.add_manual")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Email Dialog */}
      <Dialog open={bulkEmailOpen} onOpenChange={setBulkEmailOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {t("candidates.bulk.send_email")} ({selectedRows.size})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t("candidates.bulk.select_template")}</Label>
              <Select value={bulkTemplate} onValueChange={setBulkTemplate}>
                <SelectTrigger className="rounded-lg" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  <SelectValue placeholder={t("candidates.bulk.select_template")} />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.type === "email").map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bulkSending && (
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="h-4 w-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-light)', borderTopColor: 'var(--brand-gold)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-gold)' }}>{bulkProgress}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkEmailOpen(false)} className="rounded-lg" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>{t("common.cancel")}</Button>
            <Button onClick={handleBulkEmail} disabled={bulkSending} className="rounded-lg" style={{ background: 'var(--brand-gold)', color: '#1A1A1A' }}>
              {bulkSending ? t("common.loading") : t("candidates.bulk.send_email")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Upload Dialog */}
      <Dialog open={smartUploadOpen} onOpenChange={setSmartUploadOpen}>
        <DialogContent className="sm:max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {t("candidates.upload_cv")}
            </DialogTitle>
          </DialogHeader>
          <SmartUpload
            onUploadComplete={() => { fetchCandidates(); }}
            lang={locale as "he" | "en" | "tl"}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      {bulkUploadOpen && (
        <BulkUpload
          onComplete={() => fetchCandidates()}
          onClose={() => setBulkUploadOpen(false)}
        />
      )}
    </div>
  );
}
