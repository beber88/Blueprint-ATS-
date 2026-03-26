"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageLoading } from "@/components/shared/loading";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Zap, MapPin, Clock, Building, GitCompare, Users, FileText } from "lucide-react";
import { Job, Application, Candidate } from "@/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface JobDetail extends Job {
  applications: (Application & { candidate: Candidate })[];
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  const toggleCandidate = (appId: string) => {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  useEffect(() => {
    fetch(`/api/jobs/${params.id}`)
      .then((res) => res.json())
      .then(setJob)
      .catch(() => toast.error("שגיאה בטעינת משרה"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/jobs/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setJob((prev) => prev ? { ...prev, status: status as Job["status"] } : null);
      toast.success("סטטוס המשרה עודכן");
    } catch {
      toast.error("שגיאה בעדכון משרה");
    }
  };

  const runBatchScoring = async () => {
    if (!job) return;
    setScoring(true);
    const unscored = job.applications.filter((a) => a.ai_score === null);

    if (unscored.length === 0) {
      toast.info("כל המועמדים כבר דורגו");
      setScoring(false);
      return;
    }

    let scored = 0;
    let failed = 0;
    for (const app of unscored) {
      try {
        const res = await fetch("/api/cv/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: app.candidate_id, jobId: job.id }),
        });
        if (res.ok) {
          scored++;
        } else {
          const data = await res.json();
          console.error("Score failed:", data.error);
          failed++;
        }
      } catch {
        failed++;
      }
      toast.info(`מדרג: ${scored + failed}/${unscored.length}`, { id: "scoring-progress" });
    }

    if (failed > 0) {
      toast.warning(`דורגו ${scored} מועמדים, ${failed} נכשלו`);
    } else {
      toast.success(`דורגו ${scored} מועמדים בהצלחה`);
    }
    setScoring(false);
    const res = await fetch(`/api/jobs/${params.id}`);
    if (res.ok) {
      setJob(await res.json());
    }
  };

  if (loading) return <PageLoading />;
  if (!job) return <div className="p-6 text-center text-gray-500">משרה לא נמצאה</div>;

  const employmentTypeLabels: Record<string, string> = {
    "full-time": "משרה מלאה",
    "part-time": "משרה חלקית",
    contract: "חוזה",
    internship: "התמחות",
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header title={job.title} subtitle={job.department || "פרטי משרה"} />

      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-900 gap-2 rounded-xl px-3"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה למשרות
          </Button>
          <div className="flex items-center gap-3">
            <Select value={job.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-36 rounded-xl bg-white shadow-sm border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="paused">מושהה</SelectItem>
                <SelectItem value="closed">סגור</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={runBatchScoring}
              disabled={scoring}
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm gap-2 px-5"
            >
              <Zap className="h-4 w-4" />
              {scoring ? "מדרג..." : "דירוג AI"}
            </Button>
          </div>
        </div>

        {/* Job Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  {job.department && (
                    <span className="flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-gray-400" />
                      {job.department}
                    </span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      {job.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {employmentTypeLabels[job.employment_type] || job.employment_type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {(job.description || job.requirements) && (
            <div className="border-t border-gray-100 p-6 space-y-5">
              {job.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    תיאור המשרה
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
              {job.requirements && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">דרישות</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{job.requirements}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Candidates Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">מועמדים</h2>
                <p className="text-sm text-gray-500">{job.applications?.length || 0} מועמדויות</p>
              </div>
            </div>
            <Button
              variant={compareMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setCompareMode(!compareMode);
                if (compareMode) setSelectedCandidates(new Set());
              }}
              className={`rounded-xl gap-2 transition-colors ${compareMode ? "bg-blue-500 hover:bg-blue-600 text-white" : "border-gray-200"}`}
            >
              <GitCompare className="h-4 w-4" />
              {compareMode ? "ביטול השוואה" : "השוואה"}
            </Button>
          </div>

          {(job.applications || []).length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">טרם הוגשו מועמדויות</p>
              <p className="text-sm text-gray-400 mt-1">מועמדים שיגישו מועמדות יופיעו כאן</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-right">
                    {compareMode && <th className="py-3 px-4 w-12"></th>}
                    <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">מועמד/ת</th>
                    <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ציון</th>
                    <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">סטטוס</th>
                    <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">ניסיון</th>
                    <th className="py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">תאריך הגשה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {job.applications.map((app) => (
                    <tr
                      key={app.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        compareMode && selectedCandidates.has(app.id) ? "bg-blue-50/60" : ""
                      }`}
                    >
                      {compareMode && (
                        <td className="py-3.5 px-4">
                          <Checkbox
                            checked={selectedCandidates.has(app.id)}
                            onCheckedChange={() => toggleCandidate(app.id)}
                          />
                        </td>
                      )}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-semibold">
                              {app.candidate?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <Link
                            href={`/candidates/${app.candidate_id}`}
                            className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {app.candidate?.full_name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        {app.ai_score !== null ? (
                          <ScoreBadge score={app.ai_score} size="sm" />
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">לא דורג</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="py-3.5 px-5 text-sm text-gray-600">
                        {app.candidate?.experience_years != null
                          ? `${app.candidate.experience_years} שנים`
                          : "-"}
                      </td>
                      <td className="py-3.5 px-5 text-sm text-gray-500">
                        {formatDate(app.applied_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Comparison Panel */}
        {compareMode && selectedCandidates.size >= 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-blue-500" />
                השוואת מועמדים
                <span className="text-sm font-normal text-gray-500">({selectedCandidates.size} נבחרו)</span>
              </h2>
            </div>
            <div className="p-5">
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${selectedCandidates.size}, minmax(0, 1fr))` }}
              >
                {job.applications
                  .filter((app) => selectedCandidates.has(app.id))
                  .map((app) => (
                    <div key={app.id} className="bg-gray-50 rounded-xl p-5 space-y-4 border border-gray-100">
                      <div className="text-center pb-4 border-b border-gray-200">
                        <Avatar className="h-14 w-14 mx-auto mb-3">
                          <AvatarFallback className="bg-blue-100 text-blue-600 font-bold text-base">
                            {app.candidate?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <h4 className="font-bold text-gray-900">{app.candidate?.full_name}</h4>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">ציון AI</p>
                        {app.ai_score !== null ? (
                          <ScoreBadge score={app.ai_score} size="sm" />
                        ) : (
                          <span className="text-sm text-gray-400">לא דורג</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">נימוק AI</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{app.ai_reasoning || "לא זמין"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">ניסיון</p>
                        <p className="text-sm text-gray-700">
                          {app.candidate?.experience_years != null
                            ? `${app.candidate.experience_years} שנים`
                            : "לא זמין"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">כישורים</p>
                        <div className="flex flex-wrap gap-1.5">
                          {app.candidate?.skills && app.candidate.skills.length > 0 ? (
                            app.candidate.skills.map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs bg-white shadow-sm border border-gray-100">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">לא זמין</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">השכלה</p>
                        <p className="text-sm text-gray-700">{app.candidate?.education || "לא זמין"}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
