"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableLoading } from "@/components/shared/loading";
import { Plus, Users, Trophy, MapPin, Briefcase } from "lucide-react";
import { Job } from "@/types";
import { toast } from "sonner";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", department: "", description: "", requirements: "",
    location: "", employment_type: "full-time",
  });

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data || []);
    } catch {
      toast.error("שגיאה בטעינת משרות");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleCreate = async () => {
    if (!form.title) {
      toast.error("שם משרה הוא שדה חובה");
      return;
    }
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("!המשרה נוצרה");
      setCreateOpen(false);
      setForm({ title: "", department: "", description: "", requirements: "", location: "", employment_type: "full-time" });
      fetchJobs();
    } catch {
      toast.error("שגיאה ביצירת משרה");
    }
  };

  return (
    <div>
      <Header title="משרות" subtitle={`${jobs.length} משרות`} />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="ml-2 h-4 w-4" />
            משרה חדשה
          </Button>
        </div>

        {loading ? (
          <Card><CardContent className="p-6"><TableLoading /></CardContent></Card>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">אין משרות עדיין</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                צור משרה ראשונה
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-lg text-navy-900">{job.title}</h3>
                      <StatusBadge status={job.status} />
                    </div>
                    {job.department && (
                      <p className="text-sm text-muted-foreground mb-2">{job.department}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {job.candidate_count || 0} מועמדים
                      </span>
                      {job.top_score != null && job.top_score > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Trophy className="h-3 w-3" />
                          ציון עליון: {job.top_score}
                        </span>
                      )}
                    </div>
                    {job.description && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                        {job.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>יצירת משרה חדשה</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>כותרת משרה *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="למשל מפתח בכיר" />
                </div>
                <div className="space-y-2">
                  <Label>מחלקה</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="למשל הנדסה" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>מיקום</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="למשל תל אביב" />
                </div>
                <div className="space-y-2">
                  <Label>סוג העסקה</Label>
                  <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">משרה מלאה</SelectItem>
                      <SelectItem value="part-time">משרה חלקית</SelectItem>
                      <SelectItem value="contract">חוזה</SelectItem>
                      <SelectItem value="internship">התמחות</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>תיאור</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>דרישות</Label>
                <Textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>ביטול</Button>
              <Button onClick={handleCreate}>יצירת משרה</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
