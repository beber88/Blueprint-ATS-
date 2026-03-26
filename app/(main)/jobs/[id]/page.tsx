"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageLoading } from "@/components/shared/loading";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Zap, MapPin, Clock, Building, GitCompare } from "lucide-react";
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
      // Show progress
      toast.info(`מדרג: ${scored + failed}/${unscored.length}`, { id: "scoring-progress" });
    }

    if (failed > 0) {
      toast.warning(`דורגו ${scored} מועמדים, ${failed} נכשלו`);
    } else {
      toast.success(`דורגו ${scored} מועמדים בהצלחה`);
    }
    setScoring(false);
    // Refresh
    const res = await fetch(`/api/jobs/${params.id}`);
    if (res.ok) {
      setJob(await res.json());
    }
  };

  if (loading) return <PageLoading />;
  if (!job) return <div className="p-6">משרה לא נמצאה</div>;

  return (
    <div>
      <Header title={job.title} subtitle={job.department || "פרטי משרה"} />
      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          חזרה
        </Button>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold">{job.title}</h2>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {job.department && (
                    <span className="flex items-center gap-1"><Building className="h-4 w-4" />{job.department}</span>
                  )}
                  {job.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{job.employment_type}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={job.status} onValueChange={updateStatus}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="paused">מושהה</SelectItem>
                    <SelectItem value="closed">סגור</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={runBatchScoring} disabled={scoring}>
                  <Zap className="mr-2 h-4 w-4" />
                  {scoring ? "מדרג..." : "הפעל דירוג AI"}
                </Button>
              </div>
            </div>
            {job.description && (
              <div className="mt-4">
                <h3 className="font-medium mb-1">תיאור</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.description}</p>
              </div>
            )}
            {job.requirements && (
              <div className="mt-4">
                <h3 className="font-medium mb-1">דרישות</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              מועמדים ({job.applications?.length || 0})
            </CardTitle>
            <Button
              variant={compareMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setCompareMode(!compareMode);
                if (compareMode) setSelectedCandidates(new Set());
              }}
            >
              <GitCompare className="mr-2 h-4 w-4" />
              השוואה
            </Button>
          </CardHeader>
          <CardContent>
            {(job.applications || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">טרם הוגשו מועמדויות</p>
            ) : (
              <div className="space-y-2">
                {job.applications.map((app) => (
                  <div key={app.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50">
                    {compareMode && (
                      <Checkbox
                        checked={selectedCandidates.has(app.id)}
                        onCheckedChange={() => toggleCandidate(app.id)}
                      />
                    )}
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-electric-100 text-electric-700 text-xs">
                        {app.candidate?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Link href={`/candidates/${app.candidate_id}`} className="font-medium hover:text-electric-500">
                        {app.candidate?.full_name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        הוגש {formatDate(app.applied_at)}
                        {app.candidate?.experience_years && ` • ${app.candidate.experience_years} שנות ניסיון`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {app.ai_score !== null ? (
                        <ScoreBadge score={app.ai_score} size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground">לא דורג</span>
                      )}
                      <StatusBadge status={app.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {compareMode && selectedCandidates.size >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">השוואת מועמדים</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${selectedCandidates.size}, minmax(0, 1fr))` }}
              >
                {job.applications
                  .filter((app) => selectedCandidates.has(app.id))
                  .map((app) => (
                    <div key={app.id} className="space-y-3 border rounded-lg p-4">
                      <div>
                        <h4 className="font-semibold text-base">{app.candidate?.full_name}</h4>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">ציון AI</p>
                        {app.ai_score !== null ? (
                          <ScoreBadge score={app.ai_score} size="sm" />
                        ) : (
                          <span className="text-sm text-muted-foreground">לא דורג</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">נימוק AI</p>
                        <p className="text-sm mt-0.5">{app.ai_reasoning || "לא זמין"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">ניסיון</p>
                        <p className="text-sm mt-0.5">
                          {app.candidate?.experience_years != null
                            ? `${app.candidate.experience_years} שנים`
                            : "לא זמין"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">כישורים</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {app.candidate?.skills && app.candidate.skills.length > 0 ? (
                            app.candidate.skills.map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">לא זמין</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">השכלה</p>
                        <p className="text-sm mt-0.5">{app.candidate?.education || "לא זמין"}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
