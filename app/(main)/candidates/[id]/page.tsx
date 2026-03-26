"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageLoading } from "@/components/shared/loading";
import {
  Mail, Phone, MapPin, ExternalLink, FileText, Briefcase, GraduationCap,
  Calendar, MessageSquare, ArrowLeft, Save,
} from "lucide-react";
import Link from "next/link";
import { Candidate, Application, Interview, MessageSent, ActivityLog } from "@/types";
import { formatDate, formatDateTime, getStatusLabel } from "@/lib/utils";
import { toast } from "sonner";

interface CandidateDetail extends Candidate {
  applications: (Application & { job?: { id: string; title: string } })[];
  interviews: Interview[];
  messages: MessageSent[];
  activity_log: ActivityLog[];
}

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
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
      .catch(() => toast.error("טעינת המועמד/ת נכשלה"))
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
      toast.success("הסטטוס עודכן");
    } catch {
      toast.error("עדכון הסטטוס נכשל");
    }
  };

  const saveNotes = async () => {
    try {
      await fetch(`/api/candidates/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      toast.success("ההערות נשמרו");
    } catch {
      toast.error("שמירת ההערות נכשלה");
    }
  };

  if (loading) return <PageLoading />;
  if (!candidate) return <div className="p-6">המועמד/ת לא נמצא/ה</div>;

  const statuses = [
    "new", "reviewed", "shortlisted", "interview_scheduled",
    "interviewed", "approved", "rejected", "keep_for_future",
  ];

  return (
    <div>
      <Header title={candidate.full_name} subtitle="פרופיל מועמד/ת" />
      <div className="p-6 space-y-6">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          חזרה
        </Button>

        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{candidate.full_name}</h2>
                  <StatusBadge status={candidate.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                  {candidate.email && (
                    <a href={`mailto:${candidate.email}`} className="flex items-center gap-1 hover:text-electric-500">
                      <Mail className="h-4 w-4" />
                      {candidate.email}
                    </a>
                  )}
                  {candidate.phone && (
                    <a href={`tel:${candidate.phone}`} className="flex items-center gap-1 hover:text-electric-500">
                      <Phone className="h-4 w-4" />
                      {candidate.phone}
                    </a>
                  )}
                  {candidate.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {candidate.location}
                    </span>
                  )}
                  {candidate.linkedin_url && (
                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-electric-500">
                      <ExternalLink className="h-4 w-4" />
                      לינקדאין
                    </a>
                  )}
                  {candidate.cv_file_url && (
                    <a href={candidate.cv_file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-electric-500">
                      <FileText className="h-4 w-4" />
                      צפייה בקורות חיים
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Select value={candidate.status} onValueChange={updateStatus}>
                  <SelectTrigger className="w-48">
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
                <Link href={`/messages?candidateId=${candidate.id}`}>
                  <Button variant="outline">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    שליחת הודעה
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">סקירה</TabsTrigger>
            <TabsTrigger value="applications">מועמדויות ({candidate.applications?.length || 0})</TabsTrigger>
            <TabsTrigger value="interviews">ראיונות ({candidate.interviews?.length || 0})</TabsTrigger>
            <TabsTrigger value="messages">הודעות ({candidate.messages?.length || 0})</TabsTrigger>
            <TabsTrigger value="activity">פעילות</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Skills */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">כישורים</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(candidate.skills || []).map((skill) => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
                    ))}
                    {(!candidate.skills || candidate.skills.length === 0) && (
                      <p className="text-sm text-muted-foreground">לא צוינו כישורים</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">סיכום</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate.experience_years || 0} שנים ניסיון</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{candidate.education || "לא צוין"}</span>
                  </div>
                  {candidate.certifications && candidate.certifications.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">הסמכות:</p>
                      <div className="flex flex-wrap gap-1">
                        {candidate.certifications.map((cert) => (
                          <Badge key={cert} variant="outline" className="text-xs">{cert}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Experience Timeline */}
            {candidate.previous_roles && candidate.previous_roles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">ניסיון</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {candidate.previous_roles.map((role, i) => (
                      <div key={i} className="relative pl-6 border-l-2 border-electric-200 pb-4 last:pb-0">
                        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-electric-500" />
                        <h4 className="font-semibold">{role.title}</h4>
                        <p className="text-sm text-muted-foreground">{role.company} &middot; {role.duration}</p>
                        {role.description && (
                          <p className="text-sm mt-1">{role.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">הערות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="הוסיפו הערות על מועמד/ת זו..."
                  rows={4}
                />
                <Button onClick={saveNotes} size="sm">
                  <Save className="mr-2 h-4 w-4" />
                  שמירת הערות
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4">
            {(candidate.applications || []).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  אין מועמדויות עדיין
                </CardContent>
              </Card>
            ) : (
              candidate.applications.map((app) => (
                <Card key={app.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Link href={`/jobs/${app.job_id}`} className="font-semibold hover:text-electric-500">
                          {app.job?.title || "משרה לא ידועה"}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          הוגש ב-{formatDate(app.applied_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {app.ai_score !== null && <ScoreBadge score={app.ai_score} />}
                        <StatusBadge status={app.status} />
                      </div>
                    </div>
                    {app.ai_reasoning && (
                      <p className="text-sm mt-2 text-muted-foreground">{app.ai_reasoning}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Interviews Tab */}
          <TabsContent value="interviews" className="space-y-4">
            {(candidate.interviews || []).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  אין ראיונות מתוכננים
                </CardContent>
              </Card>
            ) : (
              candidate.interviews.map((interview) => (
                <Card key={interview.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {interview.scheduled_at ? formatDateTime(interview.scheduled_at) : "TBD"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {interview.type} &middot; {interview.duration_minutes} min
                          {interview.interviewer && ` &middot; ${interview.interviewer}`}
                        </p>
                      </div>
                      {interview.outcome && (
                        <Badge variant={interview.outcome === "passed" ? "default" : "destructive"}>
                          {interview.outcome}
                        </Badge>
                      )}
                    </div>
                    {interview.notes && (
                      <p className="text-sm mt-2">{interview.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            {(candidate.messages || []).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  טרם נשלחו הודעות
                </CardContent>
              </Card>
            ) : (
              candidate.messages.map((msg) => (
                <Card key={msg.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{msg.channel}</Badge>
                          {msg.subject && <span className="font-medium">{msg.subject}</span>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {msg.body}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={msg.status} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(msg.sent_at)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {(candidate.activity_log || [])
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 border-b last:border-0 pb-3">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-electric-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{getStatusLabel(activity.action)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(activity.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  {(!candidate.activity_log || candidate.activity_log.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center">אין פעילות רשומה</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
