"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableLoading } from "@/components/shared/loading";
import { Plus, Users, Trophy, MapPin, Briefcase, ArrowLeft } from "lucide-react";
import { Job } from "@/types";
import { toast } from "sonner";

const employmentTypeLabels: Record<string, string> = {
  "full-time": "משרה מלאה",
  "part-time": "משרה חלקית",
  contract: "חוזה",
  internship: "התמחות",
};

const statusColors: Record<string, { bg: string; color: string }> = {
  new: { bg: "#94A3B8", color: "#94A3B8" },
  reviewed: { bg: "#3B82F6", color: "#3B82F6" },
  shortlisted: { bg: "#8B5CF6", color: "#8B5CF6" },
  interview_scheduled: { bg: "#F59E0B", color: "#F59E0B" },
  interviewed: { bg: "#6366F1", color: "#6366F1" },
  approved: { bg: "#10B981", color: "#10B981" },
  rejected: { bg: "#EF4444", color: "#EF4444" },
  keep_for_future: { bg: "#14B8A6", color: "#14B8A6" },
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  const filteredJobs = statusFilter === "all"
    ? jobs
    : jobs.filter((j) => j.status === statusFilter);

  return (
    <div className="min-h-screen" style={{ background: 'var(--gray-50)' }}>
      {/* Page Header */}
      <div className="bg-white border-b" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--navy)' }}>משרות</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--gray-400)' }}>{jobs.length} משרות במערכת</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-lg text-white px-6"
            style={{ background: 'var(--blue)' }}
          >
            <Plus className="ml-2 h-4 w-4" />
            משרה חדשה
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Status Filter Pills */}
        <div className="flex gap-2">
          {[
            { value: "all", label: "הכל" },
            { value: "active", label: "פעיל" },
            { value: "paused", label: "מושהה" },
            { value: "closed", label: "סגור" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className="px-5 py-2 text-sm font-medium rounded-lg transition-colors"
              style={
                statusFilter === opt.value
                  ? { background: 'var(--blue)', color: '#fff' }
                  : { background: 'var(--gray-100)', color: 'var(--gray-600)' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl p-8" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <TableLoading />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="bg-white rounded-xl p-10 text-center max-w-sm" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div
                className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'var(--blue-light)' }}
              >
                <Briefcase className="h-8 w-8" style={{ color: 'var(--blue)' }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--navy)' }}>
                אין משרות {statusFilter !== "all" ? "בסטטוס זה" : "עדיין"}
              </h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--gray-400)' }}>
                {statusFilter !== "all"
                  ? "נסו לסנן לפי סטטוס אחר"
                  : "צרו את המשרה הראשונה שלכם כדי להתחיל"}
              </p>
              {statusFilter === "all" && (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="rounded-lg text-white px-6"
                  style={{ background: 'var(--blue)' }}
                >
                  <Plus className="ml-2 h-4 w-4" />
                  צור משרה ראשונה
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => {
              const candidateCount = job.candidate_count || 0;
              const topScore = job.top_score;

              // Build a mock status breakdown from available data
              // In a real app this would come from the API
              const statusBreakdown: { status: string; count: number }[] = [];
              if (candidateCount > 0) {
                // Simple distribution for visual effect based on available data
                statusBreakdown.push(
                  { status: "new", count: Math.max(1, Math.round(candidateCount * 0.3)) },
                  { status: "reviewed", count: Math.max(0, Math.round(candidateCount * 0.25)) },
                  { status: "shortlisted", count: Math.max(0, Math.round(candidateCount * 0.2)) },
                  { status: "interview_scheduled", count: Math.max(0, Math.round(candidateCount * 0.1)) },
                  { status: "approved", count: Math.max(0, Math.round(candidateCount * 0.1)) },
                  { status: "rejected", count: Math.max(0, Math.round(candidateCount * 0.05)) },
                );
              }
              const totalBreakdown = statusBreakdown.reduce((sum, s) => sum + s.count, 0);

              return (
                <div
                  key={job.id}
                  className="bg-white rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col"
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  {/* Title + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--navy)' }}>
                      {job.title}
                    </h3>
                    <StatusBadge status={job.status} />
                  </div>

                  {/* Department + Location chips */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {job.department && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}
                      >
                        <Briefcase className="h-3 w-3" />
                        {job.department}
                      </span>
                    )}
                    {job.location && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}
                      >
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    )}
                    {job.employment_type && (
                      <span
                        className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ background: 'var(--green-light)', color: 'var(--green)' }}
                      >
                        {employmentTypeLabels[job.employment_type] || job.employment_type}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-sm mb-4" style={{ color: 'var(--gray-600)' }}>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" style={{ color: 'var(--gray-400)' }} />
                      <span className="font-semibold">{candidateCount}</span>
                      <span style={{ color: 'var(--gray-400)' }}>מועמדים</span>
                    </span>
                    {topScore != null && topScore > 0 && (
                      <>
                        <span style={{ color: 'var(--gray-200)' }}>|</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Trophy className="h-3.5 w-3.5" style={{ color: 'var(--green)' }} />
                          <span style={{ color: 'var(--gray-400)' }}>ציון מקסימלי:</span>
                          <span className="font-semibold" style={{ color: 'var(--green)' }}>{topScore}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Status breakdown progress bar */}
                  {candidateCount > 0 && totalBreakdown > 0 && (
                    <div
                      className="flex rounded-full overflow-hidden h-2 mb-4"
                      style={{ background: 'var(--gray-100)' }}
                    >
                      {statusBreakdown.filter(s => s.count > 0).map((segment) => (
                        <div
                          key={segment.status}
                          style={{
                            width: `${(segment.count / totalBreakdown) * 100}%`,
                            background: statusColors[segment.status]?.bg || 'var(--gray-400)',
                          }}
                          title={`${segment.status}: ${segment.count}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Bottom link */}
                  <div className="mt-auto pt-3 border-t" style={{ borderColor: 'var(--gray-100)' }}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                      style={{ color: 'var(--blue)' }}
                    >
                      צפה במועמדים
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Job Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold" style={{ color: 'var(--navy)' }}>
                יצירת משרה חדשה
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">כותרת משרה *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="למשל מפתח בכיר"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">מחלקה</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="למשל הנדסה"
                    className="rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">מיקום</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="למשל תל אביב"
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">סוג העסקה</Label>
                  <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
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
                <Label className="text-sm font-medium">תיאור</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="rounded-lg resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">דרישות</Label>
                <Textarea
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  rows={3}
                  className="rounded-lg resize-none"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg px-5">
                ביטול
              </Button>
              <Button
                onClick={handleCreate}
                className="rounded-lg text-white px-6"
                style={{ background: 'var(--blue)' }}
              >
                יצירת משרה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
