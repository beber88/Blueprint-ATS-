"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { TableLoading } from "@/components/shared/loading";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Search, Plus, Mail, Phone, MapPin, MoreHorizontal, Eye,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Candidate } from "@/types";
import { toast } from "sonner";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [manualForm, setManualForm] = useState({
    full_name: "", email: "", phone: "", location: "", notes: "",
  });

  const fetchCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/candidates?${params}`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Reset file input so same file can be re-uploaded
    e.target.value = "";

    const totalFiles = files.length;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      setUploadProgress(
        totalFiles > 1 ? `Uploading ${i + 1}/${totalFiles} CVs...` : "Uploading and parsing CV with AI..."
      );

      const formData = new FormData();
      formData.append("file", files[i]);

      try {
        const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) {
          failCount++;
          if (totalFiles === 1) {
            toast.error(data.error || "Upload failed");
          }
        } else {
          successCount++;
          if (totalFiles === 1) {
            toast.success(`CV uploaded! ${data.candidate.full_name} added.`);
          }
        }
      } catch {
        failCount++;
        if (totalFiles === 1) {
          toast.error("Network error. Please check your connection and try again.");
        }
      }
    }

    if (totalFiles > 1) {
      if (failCount === 0) {
        toast.success(`Uploaded ${successCount}/${totalFiles} CVs successfully`);
      } else {
        toast.warning(`Uploaded ${successCount}/${totalFiles} CVs successfully, ${failCount} failed`);
      }
    }

    setUploadProgress("");
    setUploading(false);
    if (successCount > 0) {
      setUploadOpen(false);
      fetchCandidates();
    }
  };

  const handleManualCreate = async () => {
    if (!manualForm.full_name) {
      toast.error("Name is required");
      return;
    }
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Candidate created!");
      setManualOpen(false);
      setManualForm({ full_name: "", email: "", phone: "", location: "", notes: "" });
      fetchCandidates();
    } catch {
      toast.error("Failed to create candidate");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`/api/candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success("Status updated");
      fetchCandidates();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const statuses = [
    "new", "reviewed", "shortlisted", "interview_scheduled",
    "interviewed", "approved", "rejected", "keep_for_future",
  ];

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getTopScore = (candidate: Candidate & { applications?: { ai_score: number | null }[] }) => {
    const apps = candidate.applications || [];
    const scores = apps.map((a) => a.ai_score).filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.max(...scores) : null;
  };

  return (
    <div>
      <Header title="מועמדים" subtitle={`${candidates.length} מועמדים בסה״כ`} />
      <div className="p-6 space-y-4">
        {/* Actions Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם, אימייל או כישורים..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="סינון לפי סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />
              הוספה ידנית
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="ml-2 h-4 w-4" />
              העלאת קו״ח
            </Button>
          </div>
        </div>

        {/* Candidates List */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <TableLoading rows={8} />
            </CardContent>
          </Card>
        ) : candidates.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">לא נמצאו מועמדים</p>
              <div className="mt-4 flex gap-2 justify-center">
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload className="ml-2 h-4 w-4" />
                  העלו קו״ח כדי להתחיל
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => {
              const topScore = getTopScore(candidate as Candidate & { applications?: { ai_score: number | null }[] });
              return (
                <Card key={candidate.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-electric-100 text-electric-700 font-semibold">
                          {getInitials(candidate.full_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="font-semibold text-navy-900 hover:text-electric-500 transition-colors"
                        >
                          {candidate.full_name}
                        </Link>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {candidate.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {candidate.email}
                            </span>
                          )}
                          {candidate.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {candidate.phone}
                            </span>
                          )}
                          {candidate.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {candidate.location}
                            </span>
                          )}
                        </div>
                        {candidate.skills && candidate.skills.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {candidate.skills.slice(0, 5).map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                              >
                                {skill}
                              </span>
                            ))}
                            {candidate.skills.length > 5 && (
                              <span className="text-xs text-muted-foreground">
                                +{candidate.skills.length - 5} נוספים
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {topScore !== null && <ScoreBadge score={topScore} size="sm" />}
                        <StatusBadge status={candidate.status} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/candidates/${candidate.id}`}>
                                <Eye className="ml-2 h-4 w-4" />
                                צפייה בפרופיל
                              </Link>
                            </DropdownMenuItem>
                            {statuses.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={() => handleStatusChange(candidate.id, s)}
                                disabled={candidate.status === s}
                              >
                                קבע: {s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>העלאת קו״ח</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  גררו קבצי PDF או DOCX לכאן, או לחצו לבחירה (תמיכה במספר קבצים)
                </p>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  multiple
                  onChange={handleUpload}
                  disabled={uploading}
                  className="max-w-xs mx-auto"
                />
              </div>
              {uploading && (
                <p className="text-sm text-center text-muted-foreground">
                  {uploadProgress || "מעלה ומנתח קו״ח עם AI..."}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Manual Create Dialog */}
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הוספת מועמד ידנית</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>שם מלא *</Label>
                <Input
                  value={manualForm.full_name}
                  onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>אימייל</Label>
                  <Input
                    type="email"
                    value={manualForm.email}
                    onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>טלפון</Label>
                  <Input
                    value={manualForm.phone}
                    onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>מיקום</Label>
                <Input
                  value={manualForm.location}
                  onChange={(e) => setManualForm({ ...manualForm, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>הערות</Label>
                <Textarea
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualOpen(false)}>
                ביטול
              </Button>
              <Button onClick={handleManualCreate}>יצירת מועמד</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
