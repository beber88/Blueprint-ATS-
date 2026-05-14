"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { translateSkill, translateJobTitle, translateEducation, translateCertification, translateExperience } from "@/lib/i18n/content-translations";
import { SmartUpload } from "@/components/candidates/smart-upload";
import { CandidateFiles } from "@/components/candidates/candidate-files";
import { SendMessagePanel } from "@/components/candidates/send-message-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageLoading } from "@/components/shared/loading";
import {
  Mail, Phone, MapPin, ExternalLink, FileText, Briefcase, GraduationCap,
  Calendar, MessageSquare, ArrowRight, Save, Clock, User, Award,
  Video, PhoneCall, Building2, Hash, CheckCircle, XCircle, Brain, Upload, Pencil,
} from "lucide-react";
import Link from "next/link";
import { EditCandidateDialog } from "@/components/candidates/edit-candidate-dialog";
import { Candidate, Application, Interview, MessageSent, ActivityLog } from "@/types";
import { formatDate, formatDateTime, getStatusLabel } from "@/lib/utils";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/context";

interface CandidateDetail extends Candidate {
  applications: (Application & { job?: { id: string; title: string } })[];
  interviews: Interview[];
  messages: MessageSent[];
  activity_log: ActivityLog[];
}

const avatarColors = [
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-violet-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-cyan-500", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
  { bg: "bg-teal-500", text: "text-white" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const skillColors = [
  "bg-blue-50 text-blue-700 ring-blue-200/60",
  "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  "bg-violet-50 text-violet-700 ring-violet-200/60",
  "bg-amber-50 text-amber-700 ring-amber-200/60",
  "bg-rose-50 text-rose-700 ring-rose-200/60",
  "bg-cyan-50 text-cyan-700 ring-cyan-200/60",
  "bg-indigo-50 text-indigo-700 ring-indigo-200/60",
  "bg-teal-50 text-teal-700 ring-teal-200/60",
  "bg-pink-50 text-pink-700 ring-pink-200/60",
  "bg-orange-50 text-orange-700 ring-orange-200/60",
];

function getSkillColor(skill: string) {
  let hash = 0;
  for (let i = 0; i < skill.length; i++) {
    hash = skill.charCodeAt(i) + ((hash << 5) - hash);
  }
  return skillColors[Math.abs(hash) % skillColors.length];
}

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [editingCategories, setEditingCategories] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<{key: string; name_he: string; name_en: string; name_tl: string; parent_key: string | null}[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [translatedAnalysis, setTranslatedAnalysis] = useState<Record<string, unknown> | null>(null);
  const [translating, setTranslating] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setAllCategories).catch(() => {});
  }, []);

  // Auto-translate AI analysis when locale is not English
  useEffect(() => {
    const rawAnalysis = (candidate as unknown as Record<string, unknown>)?.ai_analysis;
    if (!rawAnalysis || !candidate) { setTranslatedAnalysis(null); return; }
    if (locale === "en") { setTranslatedAnalysis(rawAnalysis as Record<string, unknown>); return; }

    setTranslating(true);
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: rawAnalysis, targetLang: locale }),
    })
      .then(r => r.json())
      .then(d => setTranslatedAnalysis(d.translated || rawAnalysis))
      .catch(() => setTranslatedAnalysis(rawAnalysis as Record<string, unknown>))
      .finally(() => setTranslating(false));
  }, [candidate, locale]);

  useEffect(() => {
    fetch(`/api/candidates/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setCandidate(data);
        setNotes(data.notes || "");
        setSelectedCategories(((data as unknown as Record<string, unknown>).job_categories as string[]) || []);
      })
      .catch(() => toast.error(t("common.error")))
      .finally(() => setLoading(false));
  }, [params.id]);

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/candidates/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setCandidate((prev) => prev ? { ...prev, status: status as Candidate["status"] } : null);
      toast.success(t("candidates.toast.status_updated"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const saveNotes = async () => {
    try {
      await fetch(`/api/candidates/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      toast.success(t("common.save"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const saveCategories = async () => {
    try {
      await fetch(`/api/candidates/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_categories: selectedCategories }),
      });
      setCandidate(prev => prev ? { ...prev, job_categories: selectedCategories } as CandidateDetail : null);
      setEditingCategories(false);
      toast.success(t("common.success"));
    } catch { toast.error(t("common.error")); }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", docType);
    try {
      const res = await fetch(`/api/candidates/${params.id}/documents`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCandidate(prev => prev ? { ...prev, documents: data.documents } as CandidateDetail : null);
      toast.success(t("common.document_uploaded"));
    } catch { toast.error(t("common.error")); }
    finally { setUploadingDoc(false); if (e.target) e.target.value = ""; }
  };

  if (loading) return <PageLoading />;
  if (!candidate) return <div className="p-6">{t("candidates.no_candidates")}</div>;

  const statuses = [
    "new", "reviewed", "shortlisted", "interview_scheduled",
    "interviewed", "approved", "rejected", "keep_for_future",
  ];

  const avatarStyle = getAvatarColor(candidate.full_name);

  const topScore = (() => {
    const apps = candidate.applications || [];
    const scores = apps.map((a) => a.ai_score).filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.max(...scores) : null;
  })();

  const interviewTypeIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-4 w-4" />;
      case "phone": return <PhoneCall className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };


  const handleRunAnalysis = async () => {
    if (!candidate) return;
    toast.info(t("candidates.toast.running_ai"));
    try {
      // Try to find a job to analyze against, but don't require one
      const jobApp = candidate.applications?.[0];
      const jobId = jobApp?.job_id || null;

      const res = await fetch("/api/cv/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, jobId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed");
      }
      toast.success(t("candidates.toast.ai_complete"));
      const refreshRes = await fetch(`/api/candidates/${candidate.id}`);
      const refreshData = await refreshRes.json();
      setCandidate(refreshData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Hero Section */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border-primary)' }}>
        <div className="px-8 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="-mr-2 mb-4"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <ArrowRight className="ml-1 h-4 w-4" />
            {t("common.back")}
          </Button>

          <div className="flex items-start gap-6 pb-2">
            {/* Large Avatar */}
            <div className={`flex items-center justify-center h-20 w-20 rounded-2xl ${avatarStyle.bg} ${avatarStyle.text} text-2xl font-bold shadow-lg shrink-0`}>
              {getInitials(candidate.full_name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{candidate.full_name}</h1>
                    <StatusBadge status={candidate.status} className="text-sm px-3 py-1" />
                    {topScore !== null && (
                      <ScoreBadge score={topScore} size="md" />
                    )}
                  </div>

                  {/* Contact Row */}
                  <div className="flex items-center gap-5 text-sm flex-wrap mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {candidate.email && (
                      <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                        <Mail className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                        {candidate.email}
                      </a>
                    )}
                    {candidate.phone && (
                      <a href={`tel:${candidate.phone}`} className="flex items-center gap-1.5 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                        <Phone className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                        {candidate.phone}
                      </a>
                    )}
                    {candidate.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                        {candidate.location}
                      </span>
                    )}
                    {candidate.linkedin_url && (
                      <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                        <ExternalLink className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                        LinkedIn
                      </a>
                    )}
                    {candidate.cv_file_url && (
                      <a href={candidate.cv_file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                        <FileText className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                        {t("candidates.upload_cv")}
                      </a>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" className="h-10 rounded-lg shadow-sm hover:shadow-md transition-all" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }} onClick={() => setEditProfileOpen(true)}>
                    <Pencil className="ml-2 h-4 w-4" />
                    {t("common.edit")}
                  </Button>
                  <Link href={`/messages?candidateId=${candidate.id}`}>
                    <Button variant="outline" className="h-10 rounded-lg shadow-sm hover:shadow-md transition-all" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                      <MessageSquare className="ml-2 h-4 w-4" />
                      {t("profile.send_message")}
                    </Button>
                  </Link>
                  <Select value={candidate.status} onValueChange={updateStatus}>
                    <SelectTrigger className="w-52 h-10 rounded-lg shadow-sm text-sm" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 py-6">
        <Tabs defaultValue="overview" dir="rtl">
          <TabsList className="rounded-xl shadow-sm p-1 h-auto mb-6" style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border-primary)' }}>
            <TabsTrigger value="overview" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:shadow-sm" style={{ color: 'var(--text-secondary)' }}>
              {t("profile.overview")}
            </TabsTrigger>
            <TabsTrigger value="analysis" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:shadow-sm" style={{ color: 'var(--text-secondary)' }}>
              <Brain className="h-4 w-4 ml-1.5" />
              {t("profile.ai_analysis")}
            </TabsTrigger>
            <TabsTrigger value="applications" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:shadow-sm" style={{ color: 'var(--text-secondary)' }}>
              {t("profile.applications")}
              <span className="mr-1.5 text-xs rounded-full px-2 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {candidate.applications?.length || 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="interviews" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:shadow-sm" style={{ color: 'var(--text-secondary)' }}>
              {t("profile.interviews")}
              <span className="mr-1.5 text-xs rounded-full px-2 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {candidate.interviews?.length || 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:shadow-sm" style={{ color: 'var(--text-secondary)' }}>
              {t("profile.send_message")}
              <span className="mr-1.5 text-xs rounded-full px-2 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {candidate.messages?.length || 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="files" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:shadow-sm" style={{ color: 'var(--text-secondary)' }}>
              {t("files.title")}
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:shadow-sm" style={{ color: 'var(--text-secondary)' }}>
              {t("profile.history")}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Skills Card */}
              <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Hash className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t("profile.skills")}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(candidate.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${getSkillColor(skill)}`}
                    >
                      {translateSkill(skill, locale)}
                    </span>
                  ))}
                  {(!candidate.skills || candidate.skills.length === 0) && (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.not_assigned")}</p>
                  )}
                </div>
              </div>

              {/* Summary Card */}
              <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t("profile.overview")}</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                      <Briefcase className="h-4 w-4" style={{ color: 'var(--text-gold)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t("profile.experience")}</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{translateExperience(candidate.experience_years || 0, locale)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                      <GraduationCap className="h-4 w-4" style={{ color: 'var(--text-gold)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t("profile.education")}</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{candidate.education ? translateEducation(candidate.education, locale) : t("candidates.not_assigned")}</p>
                    </div>
                  </div>
                  {candidate.certifications && candidate.certifications.length > 0 && (
                    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                          <Award className="h-4 w-4" style={{ color: 'var(--text-gold)' }} />
                        </div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{t("profile.certifications")}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1 mr-12">
                        {candidate.certifications.map((cert) => (
                          <Badge key={cert} variant="outline" className="text-xs rounded-md">
                            {translateCertification(cert, locale)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Experience Timeline */}
            {candidate.previous_roles && candidate.previous_roles.length > 0 && (
              <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center gap-2 mb-5">
                  <Briefcase className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t("profile.experience")}</h3>
                </div>
                <div className="space-y-0">
                  {candidate.previous_roles.map((role, i) => (
                    <div key={i} className="relative pr-8 pb-6 last:pb-0">
                      {/* Timeline line */}
                      {i < candidate.previous_roles!.length - 1 && (
                        <div className="absolute right-[11px] top-6 bottom-0 w-0.5" style={{ background: 'var(--border-primary)' }} />
                      )}
                      {/* Timeline dot */}
                      <div className="absolute right-0 top-1 h-6 w-6 rounded-full flex items-center justify-center ring-4" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--brand-gold)' }} />
                      </div>
                      <div className="rounded-lg p-4" style={{ background: 'var(--bg-secondary)' }}>
                        <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{translateJobTitle(role.title || '', locale)}</h4>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {role.company}
                          <span className="mx-2" style={{ color: 'var(--border-primary)' }}>&middot;</span>
                          {role.duration}
                        </p>
                        {role.description && (
                          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{role.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Job Categories */}
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t("common.professional_classification")}
                </h3>
                <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setEditingCategories(!editingCategories)}>
                  {editingCategories ? t("common.cancel") : t("common.edit")}
                </Button>
              </div>
              {editingCategories ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {allCategories.filter(c => !c.parent_key).map(cat => {
                      const isSelected = selectedCategories.includes(cat.key);
                      return (
                        <button
                          key={cat.key}
                          onClick={() => setSelectedCategories(prev => isSelected ? prev.filter(k => k !== cat.key) : [...prev, cat.key])}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: isSelected ? 'var(--brand-gold)' : 'var(--bg-tertiary)',
                            color: isSelected ? '#1A1A1A' : 'var(--text-secondary)',
                          }}
                        >
                          {locale === "he" ? cat.name_he : locale === "tl" ? cat.name_tl : cat.name_en}
                        </button>
                      );
                    })}
                  </div>
                  <Button onClick={saveCategories} size="sm" className="rounded-lg text-white" style={{ background: 'var(--brand-gold)', color: '#1A1A1A' }}>
                    {t("common.save")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(selectedCategories.length > 0 ? selectedCategories : (((candidate as unknown as Record<string, unknown>)?.job_categories as string[]) || [])).map((key: string) => {
                    const cat = allCategories.find(c => c.key === key);
                    return (
                      <span key={key} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-gold)' }}>
                        {cat ? (locale === "he" ? cat.name_he : locale === "tl" ? cat.name_tl : cat.name_en) : key}
                      </span>
                    );
                  })}
                  {selectedCategories.length === 0 && !(((candidate as unknown as Record<string, unknown>)?.job_categories as string[] | undefined)?.length) && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t("common.not_classified")}</span>
                  )}
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t("common.documents")}
                </h3>
              </div>

              {/* Upload buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { type: "portfolio", labelKey: "common.portfolio" },
                  { type: "certification", labelKey: "common.certification" },
                  { type: "license", labelKey: "common.license" },
                  { type: "other", labelKey: "common.other_document" },
                ].map(dt => (
                  <label key={dt.type} className="cursor-pointer">
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => handleDocUpload(e, dt.type)} disabled={uploadingDoc} />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer hover:opacity-95 transition-colors" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                      <Upload className="h-3 w-3" />
                      {t(dt.labelKey)}
                    </span>
                  </label>
                ))}
              </div>

              {/* Documents list */}
              {(((candidate as unknown as Record<string, unknown>)?.documents as { name: string; url: string; type: string; uploaded_at: string }[]) || []).length > 0 ? (
                <div className="space-y-2">
                  {((candidate as unknown as Record<string, unknown>).documents as { name: string; url: string; type: string; uploaded_at: string }[]).map((doc, i) => (
                    <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg hover:opacity-95 transition-colors" style={{ background: 'var(--bg-secondary)' }}>
                      <FileText className="h-5 w-5 shrink-0" style={{ color: 'var(--text-gold)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {doc.type} • {new Date(doc.uploaded_at).toLocaleDateString(locale === "he" ? "he-IL" : locale === "tl" ? "fil-PH" : "en-US")}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t("common.no_documents")}</p>
              )}
            </div>

            {/* Notes Card */}
            <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t("interviews.form.notes")}</h3>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("interviews.form.notes")}
                rows={4}
                className="resize-none rounded-lg"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={saveNotes}
                  size="sm"
                  className="rounded-lg"
                  style={{ background: 'var(--brand-gold)', color: '#1A1A1A' }}
                >
                  <Save className="ml-2 h-4 w-4" />
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6 mt-0">
            {translating && (
              <div className="flex items-center justify-center gap-2 py-4">
                <div className="h-5 w-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--brand-gold)' }} />
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t("common.translating")}</span>
              </div>
            )}
            {(candidate as unknown as Record<string, unknown>).ai_analysis ? (() => {
              const analysis = translatedAnalysis || (candidate as unknown as Record<string, unknown>).ai_analysis as Record<string, unknown>;
              const verdict = analysis.verdict as Record<string, unknown> | undefined;
              const scorecard = analysis.scorecard as { criterion: string; max: number; score: number; notes: string }[] | undefined;
              const questions = analysis.interview_questions as { question: string; type: string; purpose: string }[] | undefined;
              return (
                <>
                  {/* Profile Snapshot */}
                  {analysis.profile_snapshot && (
                    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>{t("profile.overview")}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(analysis.profile_snapshot as Record<string, string>).map(([key, val]) => (
                          <div key={key} className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{key}</p>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold mb-3" style={{ color: 'var(--green)' }}>{t("profile.strengths")}</h3>
                      <ul className="space-y-2">
                        {((analysis.strengths as string[]) || []).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
                            <span style={{ color: 'var(--text-secondary)' }}>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold mb-3" style={{ color: 'var(--red)' }}>{t("profile.weaknesses")}</h3>
                      <ul className="space-y-2">
                        {((analysis.weaknesses as string[]) || []).map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--red)' }} />
                            <span style={{ color: 'var(--text-secondary)' }}>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Scorecard */}
                  {scorecard && scorecard.length > 0 && (
                    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>{t("profile.scorecard")}</h3>
                      <div className="space-y-3">
                        {scorecard.map((item, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <span className="text-sm w-44 shrink-0 font-medium" style={{ color: 'var(--text-secondary)' }}>{item.criterion}</span>
                            <div className="flex-1 h-2.5 rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
                              <div className="h-2.5 rounded-full transition-all" style={{
                                width: `${(item.score / item.max) * 100}%`,
                                background: item.score / item.max >= 0.7 ? 'var(--green)' : item.score / item.max >= 0.4 ? 'var(--amber)' : 'var(--red)',
                              }} />
                            </div>
                            <span className="text-sm font-bold w-16 text-left" style={{ color: 'var(--text-primary)' }}>{item.score}/{item.max}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verdict */}
                  {verdict && (
                    <div className="rounded-xl p-6" style={{
                      boxShadow: 'var(--shadow-sm)',
                      background: verdict.recommendation === 'HIRE' ? 'var(--green-light)' : verdict.recommendation === 'REJECT' ? 'var(--red-light)' : 'var(--amber-light)',
                    }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t("profile.verdict")}</p>
                          <p className="text-2xl font-bold" style={{
                            color: verdict.recommendation === 'HIRE' ? 'var(--green)' : verdict.recommendation === 'REJECT' ? 'var(--red)' : 'var(--amber)',
                          }}>
                            {verdict.recommendation as string}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.table.ai_score")}</p>
                          <p className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {(analysis.total_score as number) || (verdict.score as number) || 0}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
                        רמה: {verdict.level as string} &bull; {verdict.summary as string}
                      </p>
                    </div>
                  )}

                  {/* Interview Questions */}
                  {questions && questions.length > 0 && (
                    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--text-primary)' }}>{t("profile.interview_questions")}</h3>
                      <div className="space-y-3">
                        {questions.map((q, i) => (
                          <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                            <span className="text-xs px-2 py-0.5 rounded font-medium mb-1 inline-block" style={{
                              background: q.type === 'Technical' ? 'var(--bg-tertiary)' : q.type === 'Behavioral' ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)',
                              color: q.type === 'Technical' ? 'var(--text-gold)' : q.type === 'Behavioral' ? 'var(--text-secondary)' : 'var(--text-secondary)',
                            }}>{q.type}</span>
                            <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{q.question}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{q.purpose}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interviewer Notes */}
                  {analysis.interviewer_notes && (
                    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t("profile.interviewer_notes")}</h3>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{analysis.interviewer_notes as string}</p>
                    </div>
                  )}
                </>
              );
            })() : (
              <div className="rounded-xl p-16 text-center" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                <Brain className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
                <p className="font-semibold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>{t("profile.no_analysis")}</p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>{t("profile.run_ai_analysis")}</p>
                <Button onClick={handleRunAnalysis} className="rounded-lg text-white" style={{ background: 'var(--brand-gold)', color: '#1A1A1A' }}>
                  <Brain className="ml-2 h-4 w-4" /> {t("profile.run_analysis_btn")}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4 mt-0">
            {(candidate.applications || []).length === 0 ? (
              <div className="rounded-xl" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ background: 'var(--bg-tertiary)' }}>
                    <Briefcase className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t("candidates.no_candidates")}</p>
                </div>
              </div>
            ) : (
              candidate.applications.map((app) => (
                <div key={app.id} className="rounded-xl overflow-hidden hover:shadow-md transition-shadow" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/jobs/${app.job_id}`}
                          className="text-base font-semibold transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {app.job?.title || t("candidates.not_assigned")}
                        </Link>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                          <Calendar className="inline h-3.5 w-3.5 ml-1 -mt-0.5" />
                          הוגש ב-{formatDate(app.applied_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {app.ai_score !== null && <ScoreBadge score={app.ai_score} size="md" />}
                        <StatusBadge status={app.status} />
                      </div>
                    </div>
                    {app.ai_reasoning && (
                      <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-light)' }}>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>{t("profile.ai_analysis")}</p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{app.ai_reasoning}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Interviews Tab */}
          <TabsContent value="interviews" className="space-y-4 mt-0">
            {(candidate.interviews || []).length === 0 ? (
              <div className="rounded-xl" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ background: 'var(--bg-tertiary)' }}>
                    <Calendar className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t("profile.interviews")}</p>
                </div>
              </div>
            ) : (
              candidate.interviews.map((interview) => (
                <div key={interview.id} className="rounded-xl overflow-hidden hover:shadow-md transition-shadow" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center h-11 w-11 rounded-xl shrink-0" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-gold)' }}>
                          {interviewTypeIcon(interview.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {interview.scheduled_at ? formatDateTime(interview.scheduled_at) : t("candidates.not_assigned")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {interview.duration_minutes} דקות
                            </span>
                            <span className="capitalize">{interview.type}</span>
                            {interview.interviewer && (
                              <span className="flex items-center gap-1">
                                <User className="h-3.5 w-3.5" />
                                {interview.interviewer}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {interview.outcome && (
                        <Badge
                          variant={interview.outcome === "passed" ? "default" : "destructive"}
                          className="text-sm px-3 py-1 rounded-lg"
                        >
                          {interview.outcome === "passed" ? t("common.passed") : interview.outcome === "failed" ? t("common.failed") : interview.outcome}
                        </Badge>
                      )}
                    </div>
                    {interview.notes && (
                      <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-light)' }}>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{interview.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4 mt-0">
            <SendMessagePanel
              candidate={{ id: candidate.id, full_name: candidate.full_name, email: candidate.email || null, phone: candidate.phone || null }}
              lang={locale}
              onMessageSent={() => {
                fetch(`/api/candidates/${params.id}`).then(r => r.json()).then(setCandidate).catch(() => {});
              }}
            />
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="space-y-6 mt-0">
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{t("files.upload_files")}</h3>
              <SmartUpload
                onUploadComplete={() => {
                  fetch(`/api/candidates/${params.id}`).then(r => r.json()).then(setCandidate).catch(() => {});
                }}
                lang={locale as "he" | "en" | "tl"}
              />
            </div>
            <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{t("files.title")}</h3>
              <CandidateFiles candidateId={params.id as string} lang={locale as "he" | "en" | "tl"} />
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-0">
            <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
              {(!candidate.activity_log || candidate.activity_log.length === 0) ? (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full mb-4" style={{ background: 'var(--bg-tertiary)' }}>
                    <Clock className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t("profile.history")}</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {(candidate.activity_log || [])
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((activity, i) => (
                      <div key={activity.id} className="relative pr-8 py-4 first:pt-0 last:pb-0">
                        {/* Timeline line */}
                        {i < candidate.activity_log.length - 1 && (
                          <div className="absolute right-[11px] top-8 bottom-0 w-0.5" style={{ background: 'var(--border-primary)' }} />
                        )}
                        {/* Timeline dot */}
                        <div className="absolute right-0 top-[18px] first:top-0 h-6 w-6 rounded-full flex items-center justify-center ring-4" style={{ background: 'var(--bg-tertiary)' }}>
                          <div className="h-2 w-2 rounded-full" style={{ background: 'var(--brand-gold)' }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{getStatusLabel(activity.action)}</p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {formatDateTime(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EditCandidateDialog
        open={editProfileOpen}
        candidate={candidate}
        onClose={() => setEditProfileOpen(false)}
        onUpdated={() => {
          fetch(`/api/candidates/${params.id}`).then(r => r.json()).then((data) => {
            setCandidate(data);
            setNotes(data.notes || "");
          }).catch(() => {});
        }}
      />
    </div>
  );
}
