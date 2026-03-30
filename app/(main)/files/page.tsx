"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Briefcase, Award, Eye, Check, UserPlus, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

interface UnmatchedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  file_size: number | null;
  ai_classification_confidence: number | null;
  ai_classification_reasoning: string | null;
  metadata: { detected_person_name?: string; detected_role?: string; summary?: string } | null;
  uploaded_at: string;
}

interface CandidateOption {
  id: string;
  full_name: string;
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  cv: FileText, portfolio: Briefcase, certificate: Award,
  reference_letter: FileText, cover_letter: FileText, id_document: FileText, other: FileText,
};

export default function UnmatchedFilesPage() {
  const { t, locale } = useI18n();
  const [files, setFiles] = useState<UnmatchedFile[]>([]);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);

  const labels = {
    he: {
      title: "קבצים לא משויכים", subtitle: "קבצים שהמערכת לא הצליחה לשייך למועמד קיים",
      all_matched: "כל הקבצים משויכים!", all_matched_sub: "אין קבצים ממתינים לשיוך",
      assign: "שייך", create_new: "צור מועמד חדש", view: "צפה",
      select_candidate: "בחר מועמד", detected_name: "שם שזוהה", confidence: "ביטחון",
      file: "קובץ", type: "סוג", person: "שם שזוהה", action: "פעולה",
    },
    en: {
      title: "Unmatched Files", subtitle: "Files that couldn't be matched to an existing candidate",
      all_matched: "All files are matched!", all_matched_sub: "No files waiting for assignment",
      assign: "Assign", create_new: "Create New Candidate", view: "View",
      select_candidate: "Select Candidate", detected_name: "Detected Name", confidence: "Confidence",
      file: "File", type: "Type", person: "Detected Name", action: "Action",
    },
    tl: {
      title: "Hindi Naitugmang mga File", subtitle: "Mga file na hindi naitugma sa kandidato",
      all_matched: "Lahat ng file ay naitugma na!", all_matched_sub: "Walang file na naghihintay",
      assign: "Italaga", create_new: "Gumawa ng Bagong Kandidato", view: "Tingnan",
      select_candidate: "Pumili ng Kandidato", detected_name: "Nakitang Pangalan", confidence: "Kumpiyansa",
      file: "File", type: "Uri", person: "Nakitang Pangalan", action: "Aksyon",
    },
  };
  const l = labels[locale] || labels.he;

  useEffect(() => {
    Promise.all([
      fetch("/api/files/unmatched").then(r => r.json()),
      fetch("/api/candidates?limit=200").then(r => r.json()),
    ]).then(([filesData, candsData]) => {
      setFiles(filesData.files || []);
      setCandidates((candsData.candidates || []).map((c: CandidateOption) => ({ id: c.id, full_name: c.full_name })));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const assignFile = async (fileId: string) => {
    const candidateId = assignments[fileId];
    if (!candidateId) { toast.error(l.select_candidate); return; }
    setAssigning(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: candidateId }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("common.success"));
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setAssigning(null);
    }
  };

  const createAndAssign = async (fileId: string, detectedName: string) => {
    setAssigning(fileId);
    try {
      // Create candidate
      const createRes = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: detectedName || "Unknown", source: "file_upload" }),
      });
      if (!createRes.ok) throw new Error("Failed to create");
      const newCandidate = await createRes.json();

      // Assign file
      const assignRes = await fetch(`/api/files/${fileId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_id: newCandidate.id }),
      });
      if (!assignRes.ok) throw new Error("Failed to assign");

      toast.success(t("common.success"));
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setAssigning(null);
    }
  };

  const fileTypeLabel = (type: string) => t(`files.${type}`) || type;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--blue)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gray-50)" }}>
      <div className="bg-white dark:bg-slate-800 border-b" style={{ borderColor: "var(--gray-200)" }}>
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--navy)" }}>{l.title}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--gray-400)" }}>{l.subtitle}</p>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl">
        {files.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-16 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
            <PartyPopper className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--green)" }} />
            <p className="text-lg font-semibold" style={{ color: "var(--navy)" }}>{l.all_matched}</p>
            <p className="text-sm mt-1" style={{ color: "var(--gray-400)" }}>{l.all_matched_sub}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map(file => {
              const Icon = TYPE_ICONS[file.file_type] || FileText;
              const detectedName = file.metadata?.detected_person_name || null;
              const confidence = file.ai_classification_confidence;

              return (
                <div key={file.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 flex items-center gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                  {/* Icon */}
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--blue-light)" }}>
                    <Icon className="h-5 w-5" style={{ color: "var(--blue)" }} />
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--navy)" }}>{file.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                        {fileTypeLabel(file.file_type)}
                      </span>
                      {detectedName && (
                        <span className="text-xs" style={{ color: "var(--gray-600)" }}>
                          {l.detected_name}: <strong>{detectedName}</strong>
                        </span>
                      )}
                      {confidence != null && (
                        <span className="text-xs" style={{ color: confidence >= 0.85 ? "var(--green)" : confidence >= 0.65 ? "var(--amber)" : "var(--red)" }}>
                          {Math.round(confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Candidate selector */}
                  <Select value={assignments[file.id] || ""} onValueChange={v => setAssignments(prev => ({ ...prev, [file.id]: v }))}>
                    <SelectTrigger className="w-48 rounded-lg text-xs h-9" style={{ borderColor: "var(--gray-200)" }}>
                      <SelectValue placeholder={l.select_candidate} />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" className="rounded-lg text-xs text-white h-8" style={{ background: "var(--blue)" }}
                      disabled={assigning === file.id || !assignments[file.id]}
                      onClick={() => assignFile(file.id)}>
                      {assigning === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      <span className="mr-1">{l.assign}</span>
                    </Button>
                    {detectedName && (
                      <Button size="sm" variant="outline" className="rounded-lg text-xs h-8"
                        disabled={assigning === file.id}
                        onClick={() => createAndAssign(file.id, detectedName)}>
                        <UserPlus className="h-3 w-3 mr-1" /> {l.create_new}
                      </Button>
                    )}
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="rounded-lg text-xs h-8">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
