"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableLoading } from "@/components/shared/loading";
import { Plus, Users, Trophy, MapPin, Briefcase, Calendar } from "lucide-react";
import { Job } from "@/types";
import { toast } from "sonner";

const employmentTypeLabels: Record<string, string> = {
  "full-time": "משרה מלאה",
  "part-time": "משרה חלקית",
  contract: "חוזה",
  internship: "התמחות",
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
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header title="משרות" subtitle={`${jobs.length} משרות`} />

      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">משרות</h1>
            <p className="text-sm text-gray-500 mt-1">{jobs.length} משרות במערכת</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-6 py-2.5 shadow-sm transition-colors"
          >
            <Plus className="ml-2 h-4 w-4" />
            משרה חדשה
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-white rounded-xl shadow-sm border border-gray-100 p-1 w-fit">
          {[
            { value: "all", label: "הכל" },
            { value: "active", label: "פעיל" },
            { value: "paused", label: "מושהה" },
            { value: "closed", label: "סגור" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                statusFilter === opt.value
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <TableLoading />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center max-w-sm">
              <div className="mx-auto w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
                <Briefcase className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                אין משרות {statusFilter !== "all" ? "בסטטוס זה" : "עדיין"}
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                {statusFilter !== "all"
                  ? "נסו לסנן לפי סטטוס אחר"
                  : "צרו את המשרה הראשונה שלכם כדי להתחיל"}
              </p>
              {statusFilter === "all" && (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-6"
                >
                  <Plus className="ml-2 h-4 w-4" />
                  צור משרה ראשונה
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer h-full flex flex-col group">
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-base text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                      {job.title}
                    </h3>
                    <StatusBadge status={job.status} />
                  </div>

                  {/* Department + Location */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    {job.department && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-gray-400" />
                        {job.department}
                      </span>
                    )}
                    {job.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {job.location}
                      </span>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 mt-auto pt-3 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-semibold">{job.candidate_count || 0}</span>
                      <span className="text-gray-400 text-xs">מועמדים</span>
                    </span>

                    {job.top_score != null && job.top_score > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                        <Trophy className="h-3.5 w-3.5" />
                        <span className="font-semibold">{job.top_score}</span>
                      </span>
                    )}

                    {job.employment_type && (
                      <span className="mr-auto text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-medium">
                        {employmentTypeLabels[job.employment_type] || job.employment_type}
                      </span>
                    )}
                  </div>

                  {/* Created Date */}
                  {job.created_at && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-3">
                      <Calendar className="h-3 w-3" />
                      {new Date(job.created_at).toLocaleDateString("he-IL")}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Job Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-4 border-b border-gray-100">
              <DialogTitle className="text-xl font-bold text-gray-900">יצירת משרה חדשה</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">כותרת משרה *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="למשל מפתח בכיר"
                    className="rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">מחלקה</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="למשל הנדסה"
                    className="rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">מיקום</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="למשל תל אביב"
                    className="rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">סוג העסקה</Label>
                  <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                    <SelectTrigger className="rounded-xl border-gray-200">
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
                <Label className="text-sm font-semibold text-gray-700">תיאור</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400 resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">דרישות</Label>
                <Textarea
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  rows={3}
                  className="rounded-xl border-gray-200 focus:border-blue-400 focus:ring-blue-400 resize-none"
                />
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t border-gray-100 gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl px-5">
                ביטול
              </Button>
              <Button onClick={handleCreate} className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-6">
                יצירת משרה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
