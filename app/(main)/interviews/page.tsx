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
import { Interview } from "@/types";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    candidate_id: "", job_id: "", scheduled_at: "", duration_minutes: "60",
    interviewer: "", type: "in-person", notes: "",
  });

  const fetchInterviews = async () => {
    try {
      const res = await fetch("/api/interviews");
      setInterviews(await res.json());
    } catch {
      toast.error("Failed to load interviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInterviews(); }, []);

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
      toast.success("Interview scheduled!");
      setCreateOpen(false);
      fetchInterviews();
    } catch {
      toast.error("Failed to schedule interview");
    }
  };

  const updateOutcome = async (id: string, outcome: string, notes: string) => {
    try {
      await fetch(`/api/interviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, notes }),
      });
      toast.success("Interview updated");
      fetchInterviews();
    } catch {
      toast.error("Failed to update interview");
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
      <Header title="Interviews" subtitle={`${upcoming.length} upcoming`} />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Interview
          </Button>
        </div>

        {/* Upcoming */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Interviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No upcoming interviews</p>
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
              <CardTitle className="text-lg">Past Interviews</CardTitle>
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
                              Pass
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateOutcome(interview.id, "failed", "")}>
                              Fail
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
              <DialogTitle>Schedule Interview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Candidate ID</Label>
                <Input value={form.candidate_id} onChange={(e) => setForm({ ...form, candidate_id: e.target.value })} placeholder="Paste candidate ID" />
              </div>
              <div className="space-y-2">
                <Label>Job ID</Label>
                <Input value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })} placeholder="Paste job ID" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date & Time</Label>
                  <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in-person">In-Person</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Interviewer</Label>
                  <Input value={form.interviewer} onChange={(e) => setForm({ ...form, interviewer: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
