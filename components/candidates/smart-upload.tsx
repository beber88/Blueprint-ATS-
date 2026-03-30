"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, Briefcase, Award, X, Check, AlertTriangle, Loader2, Eye, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

type Lang = "he" | "en" | "tl";
type DocType = "cv" | "portfolio" | "certificate" | "reference_letter" | "id_document" | "cover_letter" | "other";

interface UploadResult {
  file: string;
  status: "success" | "error";
  error?: string;
  classification?: {
    type: DocType;
    confidence: number;
    reasoning: string;
    person_name: string | null;
  };
  candidate?: {
    id: string;
    matched: boolean;
    match_method: string;
    match_confidence: number;
  } | null;
  file_url?: string;
}

interface SmartUploadProps {
  onUploadComplete: () => void;
  lang?: Lang;
  candidateId?: string;
}

const FILE_TYPE_LABELS: Record<DocType, Record<Lang, string>> = {
  cv: { he: "קורות חיים", en: "CV/Resume", tl: "Resume" },
  portfolio: { he: "תיק עבודות", en: "Portfolio", tl: "Portfolio" },
  certificate: { he: "תעודה", en: "Certificate", tl: "Sertipiko" },
  reference_letter: { he: "מכתב המלצה", en: "Reference Letter", tl: "Sulat ng Rekomendasyon" },
  cover_letter: { he: "מכתב מקדים", en: "Cover Letter", tl: "Cover Letter" },
  id_document: { he: "תעודה מזהה", en: "ID Document", tl: "ID Document" },
  other: { he: "אחר", en: "Other", tl: "Iba pa" },
};

const FILE_TYPE_ICONS: Record<DocType, typeof FileText> = {
  cv: FileText, portfolio: Briefcase, certificate: Award,
  reference_letter: FileText, cover_letter: FileText, id_document: FileText, other: FileText,
};

const TEXTS = {
  he: {
    dropzone: "גרור קבצים או תיקייה לכאן",
    subtitle: "קורות חיים, תיקי עבודות, תעודות - המערכת תזהה אוטומטית",
    formats: "PDF, DOC, DOCX — עד 50MB לקובץ",
    select_files: "בחר קבצים",
    select_folder: "בחר תיקייה",
    analyzing: "מנתח מסמכים...",
    analyzing_sub: "AI מזהה סוג מסמך ומתאים למועמד",
    matched: "שויך למועמד",
    new_candidate: "מועמד חדש נוצר",
    no_match: "לא נמצא מועמד תואם",
    view: "צפה",
    done: "הושלם",
    close: "סגור",
    upload_more: "העלה עוד",
    processing: "מעבד",
    of: "מתוך",
    succeeded: "הצליחו",
    failed_label: "נכשלו",
    results: "תוצאות העלאה",
    no_valid: "לא נמצאו קבצי PDF או Word",
    uploading_batch: "מעלה קבצים",
  },
  en: {
    dropzone: "Drag files or folder here",
    subtitle: "CVs, Portfolios, Certificates - AI auto-classifies",
    formats: "PDF, DOC, DOCX — up to 50MB per file",
    select_files: "Select files",
    select_folder: "Select folder",
    analyzing: "Analyzing documents...",
    analyzing_sub: "AI is identifying document type and matching to candidate",
    matched: "Matched to candidate",
    new_candidate: "New candidate created",
    no_match: "No matching candidate found",
    view: "View",
    done: "Done",
    close: "Close",
    upload_more: "Upload More",
    processing: "Processing",
    of: "of",
    succeeded: "succeeded",
    failed_label: "failed",
    results: "Upload results",
    no_valid: "No PDF or Word files found",
    uploading_batch: "Uploading files",
  },
  tl: {
    dropzone: "I-drag ang mga file o folder dito",
    subtitle: "CVs, Portfolios, Sertipiko - auto-classify ng AI",
    formats: "PDF, DOC, DOCX — hanggang 50MB bawat file",
    select_files: "Pumili ng files",
    select_folder: "Pumili ng folder",
    analyzing: "Sinusuri ang mga dokumento...",
    analyzing_sub: "Tinutukoy ng AI ang uri ng dokumento",
    matched: "Naitugma sa kandidato",
    new_candidate: "Bagong kandidato ang nagawa",
    no_match: "Walang nahanap na kandidato",
    view: "Tingnan",
    done: "Tapos na",
    close: "Isara",
    upload_more: "Mag-upload pa",
    processing: "Pinoproseso",
    of: "sa",
    succeeded: "nagtagumpay",
    failed_label: "nabigo",
    results: "Resulta ng upload",
    no_valid: "Walang PDF o Word files na nahanap",
    uploading_batch: "Nag-a-upload ng files",
  },
};

export function SmartUpload({ onUploadComplete, lang = "he", candidateId }: SmartUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: "" });
  const [results, setResults] = useState<UploadResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const t = TEXTS[lang] || TEXTS.he;

  // Set webkitdirectory attribute via ref (TypeScript doesn't support it natively)
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const processFiles = async (files: File[]) => {
    // Filter valid files
    const validFiles = files.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ext && ["pdf", "doc", "docx"].includes(ext) && f.size <= 50 * 1024 * 1024;
    });

    if (validFiles.length === 0) {
      alert(t.no_valid);
      return;
    }

    setUploading(true);
    setResults([]);
    setShowResults(false);

    const allResults: UploadResult[] = [];
    const batchSize = 3; // Process 3 files at a time to avoid timeout

    for (let i = 0; i < validFiles.length; i += batchSize) {
      const batch = validFiles.slice(i, i + batchSize);
      const batchEnd = Math.min(i + batchSize, validFiles.length);

      setProgress({
        current: i,
        total: validFiles.length,
        status: `${t.uploading_batch} ${i + 1}-${batchEnd} ${t.of} ${validFiles.length}...`,
      });

      const formData = new FormData();
      batch.forEach(f => formData.append("files", f));
      if (candidateId) formData.append("candidateId", candidateId);

      try {
        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          batch.forEach(f => allResults.push({ file: f.name, status: "error", error: data.error || "Upload failed" }));
        } else if (data.results) {
          allResults.push(...data.results);
        }
      } catch {
        batch.forEach(f => allResults.push({ file: f.name, status: "error", error: "Network error" }));
      }
    }

    setProgress({ current: validFiles.length, total: validFiles.length, status: "" });
    setResults(allResults);
    setUploading(false);
    setShowResults(true);

    if (allResults.some(r => r.status === "success")) {
      onUploadComplete();
    }

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return { bg: "var(--status-approved-bg)", color: "var(--status-approved-text)" };
    if (confidence >= 0.65) return { bg: "var(--status-shortlisted-bg)", color: "var(--status-shortlisted-text)" };
    return { bg: "var(--status-rejected-bg)", color: "var(--status-rejected-text)" };
  };

  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" multiple className="hidden" onChange={handleFileSelect} />
      <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

      {/* Drop zone */}
      {!showResults && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="border-2 border-dashed rounded-xl p-8 text-center transition-all"
          style={{
            borderColor: isDragging ? "var(--brand-gold)" : "var(--border-primary)",
            background: isDragging ? "var(--bg-tertiary)" : "transparent",
            opacity: uploading ? 0.6 : 1,
            pointerEvents: uploading ? "none" : "auto",
            cursor: uploading ? "default" : "pointer",
          }}
        >
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="h-10 w-10 mx-auto animate-spin" style={{ color: "var(--brand-gold)" }} />
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.analyzing}</p>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{progress.status || t.analyzing_sub}</p>
              {/* Progress bar */}
              <div className="w-full max-w-xs mx-auto rounded-full h-2" style={{ background: "var(--bg-tertiary)" }}>
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`, background: "var(--brand-gold)" }}
                />
              </div>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {progress.current} {t.of} {progress.total}
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{t.dropzone}</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>{t.subtitle}</p>

              {/* Two buttons: files + folder */}
              <div className="flex gap-3 justify-center mt-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs px-4 py-2 rounded-lg transition-colors"
                  style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                >
                  <FileText className="inline h-3.5 w-3.5 mr-1.5" style={{ verticalAlign: "-2px" }} />
                  {t.select_files}
                </button>
                <button
                  onClick={() => {
                    if (folderInputRef.current) {
                      folderInputRef.current.setAttribute("webkitdirectory", "");
                      folderInputRef.current.setAttribute("directory", "");
                      folderInputRef.current.click();
                    }
                  }}
                  className="text-xs px-4 py-2 rounded-lg transition-colors"
                  style={{ border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                >
                  <FolderOpen className="inline h-3.5 w-3.5 mr-1.5" style={{ verticalAlign: "-2px" }} />
                  {t.select_folder}
                </button>
              </div>

              <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>{t.formats}</p>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {showResults && results.length > 0 && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
            <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.results}</h4>
            <div className="flex gap-3 text-xs">
              <span style={{ color: "var(--status-approved-text)" }}>
                <Check className="inline h-3 w-3" /> {successCount} {t.succeeded}
              </span>
              {errorCount > 0 && (
                <span style={{ color: "var(--status-rejected-text)" }}>
                  <X className="inline h-3 w-3" /> {errorCount} {t.failed_label}
                </span>
              )}
            </div>
          </div>

          {/* Individual results */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {results.map((result, i) => {
              const docType = result.classification?.type || "other";
              const Icon = FILE_TYPE_ICONS[docType] || FileText;
              const typeLabel = FILE_TYPE_LABELS[docType]?.[lang] || docType;
              const confidence = result.classification?.confidence || 0;
              const confColor = getConfidenceColor(confidence);

              return (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-light)" }}>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--bg-tertiary)" }}>
                    <Icon className="h-4 w-4" style={{ color: "var(--brand-gold)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{result.file}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-tertiary)", color: "var(--brand-gold)" }}>{typeLabel}</span>
                      {result.status === "success" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: confColor.bg, color: confColor.color }}>
                          {Math.round(confidence * 100)}%
                        </span>
                      )}
                      {result.status === "success" && result.candidate ? (
                        <span className="text-[10px]" style={{ color: "var(--status-approved-text)" }}>
                          <Check className="inline h-2.5 w-2.5" /> {result.classification?.type === "cv" ? t.new_candidate : t.matched}
                        </span>
                      ) : result.status === "success" && !result.candidate ? (
                        <span className="text-[10px]" style={{ color: "var(--status-shortlisted-text)" }}>
                          <AlertTriangle className="inline h-2.5 w-2.5" /> {t.no_match}
                        </span>
                      ) : null}
                      {result.status === "error" && (
                        <span className="text-[10px]" style={{ color: "var(--status-rejected-text)" }}>{result.error}</span>
                      )}
                    </div>
                  </div>
                  {result.file_url && (
                    <a href={result.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="rounded-lg text-xs h-7 px-2">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => { setShowResults(false); setResults([]); }}>
              {t.upload_more}
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setShowResults(false)}>
              {t.close}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
