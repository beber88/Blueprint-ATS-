"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/shared/loading";
import { Plus, Calendar, Clock, User, Video, Phone, MapPin } from "lucide-react";
import { Interview, Candidate, Job } from "@/types";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState({
    candidate_id: "", job_id: "", scheduled_at: "", duration_minutes: "60",
    interviewer: "", type: "in-person", notes: "",
  });

  const fetchInterviews = async () => {
    try {
      const res = await fetch("/api/interviews");
      setInterviews(await res.json());
    } catch {
      toast.error("שגיאה בטעינת ראיונות");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInterviews(); }, []);

  useEffect(() => {
    fetch("/api/candidates").then((res) => res.json()).then(setCandidates).catch(() => {});
    fetch("/api/jobs").then((res) => res.json()).then(setJobs).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duration_minutes: parseInt(form.duration_minutes),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("הראיון נקבע!");
      setCreateOpen(false);
      fetchInterviews();
    } catch {
      toast.error("שגיאה בקביעת ראיון");
    }
  };

  const updateOutcome = async (id: string, outcome: string, notes: string) => {
    try {
      await fetch(`/api/interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, notes }),
      });
      toast.success("הראיון עודכן");
      fetchInterviews();
    } catch {
      toast.error("שגיאה בעדכון ראיון");
    }
  };

  const typeIcons = {
    "in-person": MapPin,
    video: Video,
    phone: Phone,
  };

  const now = new Date();
  const upcoming = interviews.filter((i) => i.scheduled_at && new Date(i.scheduled_at) >= now);
  const past = interviews.filter((i) => i.scheduled_at && new Date(i.scheduled_at) < now);

  if (loading) return <PageLoading />;

  return (
    <div>
      <Header title="ראיונות" subtitle={`${upcoming.length} קרובים`} />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            קביעת ראיון
          </Button>
        </div>

        {/* Upcoming */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              ראיונות קרובים
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">אין ראיונות קרובים</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((interview) => {
                  const TypeIcon = typeIcons[interview.type] || MapPin;
                  const app = interview.application as Interview["application"];
                  return (
                    <div key={interview.id} className="flex items-center gap-4 p-4 rounded-lg border">
                      <div className="flex flex-col items-center justify-center bg-electric-50 rounded-lg p-3 min-w-[60px]">
                        <span className="text-lg font-bold text-electric-600">
                          {interview.scheduled_at ? new Date(interview.scheduled_at).getDate() : "?"}
                        </span>
                        <span className="text-xs text-electric-500">
                          {interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString("en", { month: "short" }) : ""}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/candidates/${app?.candidate?.id}`} className="font-semibold hover:text-electric-500">
                            {app?.candidate?.full_name || "Unknown"}
                          </Link>
                          <Badge variant="outline" className="text-xs">
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {interview.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {app?.job?.title || "Unknown Job"}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {interview.scheduled_at ? formatDateTime(interview.scheduled_at) : "TBD"}
                          </span>
                          <span>{interview.duration_minutes} min</span>
                          {interview.interviewer && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {interview.interviewer}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past */}
        {past.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ראיונות קודמים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {past.map((interview) => {
                  const app = interview.application as Interview["application"];
                  return (
                    <div key={interview.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <Link href={`/candidates/${app?.candidate?.id}`} className="font-medium hover:text-electric-500">
                          {app?.candidate?.full_name || "Unknown"}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {app?.job?.title} &middot; {interview.scheduled_at ? formatDateTime(interview.scheduled_at) : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {interview.outcome ? (
                          <Badge variant={interview.outcome === "passed" ? "default" : "destructive"}>
                            {interview.outcome}
                          </Badge>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateOutcome(interview.id, "passed", "")}>
                              עבר
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateOutcome(interview.id, "failed", "")}>
                              נכשל
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>קביעת ראיון</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>מועמד/ת</Label>
                <Select value={form.candidate_id} onValueChange={(v) => setForm({ ...form, candidate_id: v })}>
                  <SelectTrigger><SelectValue placeholder="בחר מועמד/ת" /></SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>משרה</Label>
                <Select value={form.job_id} onValueChange={(v) => setForm({ ...form, job_id: v })}>
                  <SelectTrigger><SelectValue placeholder="בחר משרה" /></SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תאריך ושעה</Label>
                  <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>משך (דקות)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>סוג</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in-person">פרונטלי</SelectItem>
                      <SelectItem value="video">וידאו</SelectItem>
                      <SelectItem value="phone">טלפוני</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>מראיין/ת</Label>
                  <Input value={form.interviewer} onChange={(e) => setForm({ ...form, interviewer: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>הערות</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>ביטול</Button>
              <Button onClick={handleCreate}>קבע ראיון</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
