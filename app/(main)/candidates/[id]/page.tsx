"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  Send, Video, PhoneCall, Building2, Hash, CheckCircle, XCircle, Brain,
} from "lucide-react";
import Link from "next/link";
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
  const { t } = useI18n();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch(`/api/candidates/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setCandidate(data);
        setNotes(data.notes || "");
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

  const channelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      default: return <Send className="h-4 w-4" />;
    }
  };

  const handleRunAnalysis = async () => {
    if (!candidate) return;
    const jobApp = candidate.applications?.[0];
    if (!jobApp?.job_id) {
      toast.error(t("common.error"));
      return;
    }
    toast.info(t("common.loading"));
    try {
      const res = await fetch("/api/cv/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, jobId: jobApp.job_id }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("profile.ai_analysis"));
      const refreshRes = await fetch(`/api/candidates/${candidate.id}`);
      const refreshData = await refreshRes.json();
      setCandidate(refreshData);
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Hero Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-700 -mr-2 mb-4"
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
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{candidate.full_name}</h1>
                    <StatusBadge status={candidate.status} className="text-sm px-3 py-1" />
                    {topScore !== null && (
                      <ScoreBadge score={topScore} size="md" />
                    )}
                  </div>

                  {/* Contact Row */}
                  <div className="flex items-center gap-5 text-sm text-slate-500 flex-wrap mt-1">
                    {candidate.email && (
                      <a href={`mailto:${candidate.email}`} className="flex items-center gap-1.5 hover:text-electric-600 transition-colors">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {candidate.email}
                      </a>
                    )}
                    {candidate.phone && (
                      <a href={`tel:${candidate.phone}`} className="flex items-center gap-1.5 hover:text-electric-600 transition-colors">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {candidate.phone}
                      </a>
                    )}
                    {candidate.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        {candidate.location}
                      </span>
                    )}
                    {candidate.linkedin_url && (
                      <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-electric-600 transition-colors">
                        <ExternalLink className="h-4 w-4 text-slate-400" />
                        LinkedIn
                      </a>
                    )}
                    {candidate.cv_file_url && (
                      <a href={candidate.cv_file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-electric-600 transition-colors">
                        <FileText className="h-4 w-4 text-slate-400" />
                        {t("candidates.upload_cv")}
                      </a>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/messages?candidateId=${candidate.id}`}>
                    <Button variant="outline" className="h-10 rounded-lg border-slate-200 shadow-sm hover:shadow-md transition-all">
                      <MessageSquare className="ml-2 h-4 w-4" />
                      {t("profile.send_message")}
                    </Button>
                  </Link>
                  <Select value={candidate.status} onValueChange={updateStatus}>
                    <SelectTrigger className="w-52 h-10 rounded-lg border-slate-200 shadow-sm text-sm">
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
          <TabsList className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 h-auto mb-6">
            <TabsTrigger value="overview" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:bg-electric-50 data-[state=active]:text-electric-700 data-[state=active]:shadow-sm">
              {t("profile.overview")}
            </TabsTrigger>
            <TabsTrigger value="analysis" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:bg-electric-50 data-[state=active]:text-electric-700 data-[state=active]:shadow-sm">
              <Brain className="h-4 w-4 ml-1.5" />
              {t("profile.ai_analysis")}
            </TabsTrigger>
            <TabsTrigger value="applications" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:bg-electric-50 data-[state=active]:text-electric-700 data-[state=active]:shadow-sm">
              {t("profile.applications")}
              <span className="mr-1.5 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                {candidate.applications?.length || 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="interviews" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:bg-electric-50 data-[state=active]:text-electric-700 data-[state=active]:shadow-sm">
              {t("profile.interviews")}
              <span className="mr-1.5 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                {candidate.interviews?.length || 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:bg-electric-50 data-[state=active]:text-electric-700 data-[state=active]:shadow-sm">
              {t("profile.send_message")}
              <span className="mr-1.5 text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                {candidate.messages?.length || 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-lg px-5 py-2.5 text-sm data-[state=active]:bg-electric-50 data-[state=active]:text-electric-700 data-[state=active]:shadow-sm">
              {t("profile.history")}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Skills Card */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Hash className="h-5 w-5 text-slate-400" />
                  <h3 className="text-base font-semibold text-slate-900">{t("profile.skills")}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(candidate.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${getSkillColor(skill)}`}
                    >
                      {skill}
                    </span>
                  ))}
                  {(!candidate.skills || candidate.skills.length === 0) && (
                    <p className="text-sm text-slate-400">{t("candidates.not_assigned")}</p>
                  )}
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-slate-400" />
                  <h3 className="text-base font-semibold text-slate-900">{t("profile.overview")}</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-100">
                      <Briefcase className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">{t("profile.experience")}</p>
                      <p className="text-sm font-semibold text-slate-900">{candidate.experience_years || 0} {t("candidates.years")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-violet-100">
                      <GraduationCap className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">{t("profile.education")}</p>
                      <p className="text-sm font-semibold text-slate-900">{candidate.education || t("candidates.not_assigned")}</p>
                    </div>
                  </div>
                  {candidate.certifications && candidate.certifications.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-100">
                          <Award className="h-4 w-4 text-amber-600" />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{t("profile.certifications")}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1 mr-12">
                        {candidate.certifications.map((cert) => (
                          <Badge key={cert} variant="outline" className="text-xs rounded-md">
                            {cert}
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
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Briefcase className="h-5 w-5 text-slate-400" />
                  <h3 className="text-base font-semibold text-slate-900">{t("profile.experience")}</h3>
                </div>
                <div className="space-y-0">
                  {candidate.previous_roles.map((role, i) => (
                    <div key={i} className="relative pr-8 pb-6 last:pb-0">
                      {/* Timeline line */}
                      {i < candidate.previous_roles!.length - 1 && (
                        <div className="absolute right-[11px] top-6 bottom-0 w-0.5 bg-slate-200" />
                      )}
                      {/* Timeline dot */}
                      <div className="absolute right-0 top-1 h-6 w-6 rounded-full bg-electric-100 flex items-center justify-center ring-4 ring-white">
                        <div className="h-2.5 w-2.5 rounded-full bg-electric-500" />
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <h4 className="font-semibold text-slate-900">{role.title}</h4>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {role.company}
                          <span className="mx-2 text-slate-300">&middot;</span>
                          {role.duration}
                        </p>
                        {role.description && (
                          <p className="text-sm text-slate-600 mt-2 leading-relaxed">{role.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-slate-400" />
                <h3 className="text-base font-semibold text-slate-900">{t("interviews.form.notes")}</h3>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("interviews.form.notes")}
                rows={4}
                className="resize-none rounded-lg border-slate-200 focus:ring-2 focus:ring-electric-500/20 focus:border-electric-400"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={saveNotes}
                  size="sm"
                  className="rounded-lg bg-electric-600 hover:bg-electric-700"
                >
                  <Save className="ml-2 h-4 w-4" />
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6 mt-0">
            {(candidate as unknown as Record<string, unknown>).ai_analysis ? (() => {
              const analysis = (candidate as unknown as Record<string, unknown>).ai_analysis as Record<string, unknown>;
              const verdict = analysis.verdict as Record<string, unknown> | undefined;
              const scorecard = analysis.scorecard as { criterion: string; max: number; score: number; notes: string }[] | undefined;
              const questions = analysis.interview_questions as { question: string; type: string; purpose: string }[] | undefined;
              return (
                <>
                  {/* Profile Snapshot */}
                  {analysis.profile_snapshot && (
                    <div className="bg-white rounded-xl p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--navy)' }}>{t("profile.overview")}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(analysis.profile_snapshot as Record<string, string>).map(([key, val]) => (
                          <div key={key} className="p-3 rounded-lg" style={{ background: 'var(--gray-50)' }}>
                            <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-400)' }}>{key}</p>
                            <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold mb-3" style={{ color: 'var(--green)' }}>{t("profile.strengths")}</h3>
                      <ul className="space-y-2">
                        {((analysis.strengths as string[]) || []).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
                            <span style={{ color: 'var(--gray-600)' }}>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white rounded-xl p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold mb-3" style={{ color: 'var(--red)' }}>{t("profile.weaknesses")}</h3>
                      <ul className="space-y-2">
                        {((analysis.weaknesses as string[]) || []).map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--red)' }} />
                            <span style={{ color: 'var(--gray-600)' }}>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Scorecard */}
                  {scorecard && scorecard.length > 0 && (
                    <div className="bg-white rounded-xl p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--navy)' }}>{t("profile.scorecard")}</h3>
                      <div className="space-y-3">
                        {scorecard.map((item, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <span className="text-sm w-44 shrink-0 font-medium" style={{ color: 'var(--gray-600)' }}>{item.criterion}</span>
                            <div className="flex-1 h-2.5 rounded-full" style={{ background: 'var(--gray-100)' }}>
                              <div className="h-2.5 rounded-full transition-all" style={{
                                width: `${(item.score / item.max) * 100}%`,
                                background: item.score / item.max >= 0.7 ? 'var(--green)' : item.score / item.max >= 0.4 ? 'var(--amber)' : 'var(--red)',
                              }} />
                            </div>
                            <span className="text-sm font-bold w-16 text-left" style={{ color: 'var(--navy)' }}>{item.score}/{item.max}</span>
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
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-400)' }}>{t("profile.verdict")}</p>
                          <p className="text-2xl font-bold" style={{
                            color: verdict.recommendation === 'HIRE' ? 'var(--green)' : verdict.recommendation === 'REJECT' ? 'var(--red)' : 'var(--amber)',
                          }}>
                            {verdict.recommendation as string}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-400)' }}>{t("candidates.table.ai_score")}</p>
                          <p className="text-4xl font-bold" style={{ color: 'var(--navy)' }}>
                            {(analysis.total_score as number) || (verdict.score as number) || 0}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm mt-3" style={{ color: 'var(--gray-600)' }}>
                        רמה: {verdict.level as string} &bull; {verdict.summary as string}
                      </p>
                    </div>
                  )}

                  {/* Interview Questions */}
                  {questions && questions.length > 0 && (
                    <div className="bg-white rounded-xl p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--navy)' }}>{t("profile.interview_questions")}</h3>
                      <div className="space-y-3">
                        {questions.map((q, i) => (
                          <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--gray-50)' }}>
                            <span className="text-xs px-2 py-0.5 rounded font-medium mb-1 inline-block" style={{
                              background: q.type === 'Technical' ? 'var(--blue-light)' : q.type === 'Behavioral' ? 'var(--purple-light)' : 'var(--amber-light)',
                              color: q.type === 'Technical' ? 'var(--blue)' : q.type === 'Behavioral' ? 'var(--purple)' : 'var(--amber)',
                            }}>{q.type}</span>
                            <p className="text-sm font-medium mt-1" style={{ color: 'var(--navy)' }}>{q.question}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--gray-400)' }}>{q.purpose}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interviewer Notes */}
                  {analysis.interviewer_notes && (
                    <div className="bg-white rounded-xl p-6" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <h3 className="font-bold mb-2" style={{ color: 'var(--navy)' }}>{t("profile.interviewer_notes")}</h3>
                      <p className="text-sm" style={{ color: 'var(--gray-600)' }}>{analysis.interviewer_notes as string}</p>
                    </div>
                  )}
                </>
              );
            })() : (
              <div className="bg-white rounded-xl p-16 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <Brain className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--gray-300)' }} />
                <p className="font-semibold text-lg mb-2" style={{ color: 'var(--navy)' }}>{t("profile.no_analysis")}</p>
                <p className="text-sm mb-4" style={{ color: 'var(--gray-400)' }}>{t("profile.run_ai_analysis")}</p>
                <Button onClick={handleRunAnalysis} className="rounded-lg text-white" style={{ background: 'var(--blue)' }}>
                  <Brain className="ml-2 h-4 w-4" /> {t("profile.run_analysis_btn")}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4 mt-0">
            {(candidate.applications || []).length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                    <Briefcase className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500">{t("candidates.no_candidates")}</p>
                </div>
              </div>
            ) : (
              candidate.applications.map((app) => (
                <div key={app.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/jobs/${app.job_id}`}
                          className="text-base font-semibold text-slate-900 hover:text-electric-600 transition-colors"
                        >
                          {app.job?.title || t("candidates.not_assigned")}
                        </Link>
                        <p className="text-sm text-slate-500 mt-1">
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
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-xs font-medium text-slate-500 mb-1">{t("profile.ai_analysis")}</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{app.ai_reasoning}</p>
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
              <div className="bg-white rounded-xl shadow-sm">
                <div className="py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                    <Calendar className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500">{t("profile.interviews")}</p>
                </div>
              </div>
            ) : (
              candidate.interviews.map((interview) => (
                <div key={interview.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-electric-50 text-electric-600 shrink-0">
                          {interviewTypeIcon(interview.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {interview.scheduled_at ? formatDateTime(interview.scheduled_at) : t("candidates.not_assigned")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
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
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-sm text-slate-600 leading-relaxed">{interview.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4 mt-0">
            {(candidate.messages || []).length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm">
                <div className="py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                    <MessageSquare className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500">{t("profile.send_message")}</p>
                </div>
              </div>
            ) : (
              candidate.messages.map((msg) => (
                <div key={msg.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`flex items-center justify-center h-11 w-11 rounded-xl shrink-0 ${
                          msg.channel === "email" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                        }`}>
                          {channelIcon(msg.channel)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className={`text-xs rounded-md ${
                                msg.channel === "email" ? "border-blue-200 text-blue-700 bg-blue-50" : "border-emerald-200 text-emerald-700 bg-emerald-50"
                              }`}
                            >
                              {msg.channel === "email" ? t("candidates.bulk.send_email") : "WhatsApp"}
                            </Badge>
                            {msg.subject && (
                              <span className="font-semibold text-slate-900 truncate">{msg.subject}</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                            {msg.body}
                          </p>
                        </div>
                      </div>
                      <div className="text-left shrink-0">
                        <StatusBadge status={msg.status} />
                        <p className="text-xs text-slate-400 mt-1.5">
                          {formatDateTime(msg.sent_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-0">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {(!candidate.activity_log || candidate.activity_log.length === 0) ? (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
                    <Clock className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500">{t("profile.history")}</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {(candidate.activity_log || [])
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((activity, i) => (
                      <div key={activity.id} className="relative pr-8 py-4 first:pt-0 last:pb-0">
                        {/* Timeline line */}
                        {i < candidate.activity_log.length - 1 && (
                          <div className="absolute right-[11px] top-8 bottom-0 w-0.5 bg-slate-200" />
                        )}
                        {/* Timeline dot */}
                        <div className="absolute right-0 top-[18px] first:top-0 h-6 w-6 rounded-full bg-electric-50 flex items-center justify-center ring-4 ring-white">
                          <div className="h-2 w-2 rounded-full bg-electric-500" />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">{getStatusLabel(activity.action)}</p>
                          <p className="text-xs text-slate-400">
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
    </div>
  );
}
