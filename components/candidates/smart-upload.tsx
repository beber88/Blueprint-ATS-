"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Briefcase, Award, X, Check, AlertTriangle, Loader2, Eye } from "lucide-react";
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
  cv: FileText,
  portfolio: Briefcase,
  certificate: Award,
  reference_letter: FileText,
  cover_letter: FileText,
  id_document: FileText,
  other: FileText,
};

const TEXTS = {
  he: {
    dropzone: "גרור קבצים לכאן או לחץ לבחירה",
    subtitle: "קורות חיים, תיקי עבודות, תעודות - המערכת תזהה אוטומטית",
    formats: "PDF, DOC, DOCX — עד 50MB",
    analyzing: "מנתח מסמכים...",
    analyzing_sub: "AI מזהה סוג מסמך ומתאים למועמד",
    matched: "שויך למועמד",
    new_candidate: "מועמד חדש נוצר",
    no_match: "לא נמצא מועמד תואם",
    view: "צפה",
    confidence: "ביטחון",
    done: "הושלם",
    close: "סגור",
    upload_more: "העלה עוד",
    processing: "מעבד",
    of: "מתוך",
  },
  en: {
    dropzone: "Drag files here or click to select",
    subtitle: "CVs, Portfolios, Certificates - AI auto-classifies",
    formats: "PDF, DOC, DOCX — up to 50MB",
    analyzing: "Analyzing documents...",
    analyzing_sub: "AI is identifying document type and matching to candidate",
    matched: "Matched to candidate",
    new_candidate: "New candidate created",
    no_match: "No matching candidate found",
    view: "View",
    confidence: "Confidence",
    done: "Done",
    close: "Close",
    upload_more: "Upload More",
    processing: "Processing",
    of: "of",
  },
  tl: {
    dropzone: "I-drag ang mga file dito o mag-click",
    subtitle: "CVs, Portfolios, Sertipiko - auto-classify ng AI",
    formats: "PDF, DOC, DOCX — hanggang 50MB",
    analyzing: "Sinusuri ang mga dokumento...",
    analyzing_sub: "Tinutukoy ng AI ang uri ng dokumento at itinatugma sa kandidato",
    matched: "Naitugma sa kandidato",
    new_candidate: "Bagong kandidato ang nagawa",
    no_match: "Walang nahanap na tumutugmang kandidato",
    view: "Tingnan",
    confidence: "Kumpiyansa",
    done: "Tapos na",
    close: "Isara",
    upload_more: "Mag-upload pa",
    processing: "Pinoproseso",
    of: "sa",
  },
};

export function SmartUpload({ onUploadComplete, lang = "he" }: SmartUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<UploadResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = TEXTS[lang] || TEXTS.he;

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
    const validFiles = files.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ext && ["pdf", "doc", "docx"].includes(ext) && f.size <= 50 * 1024 * 1024;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    setResults([]);
    setShowResults(false);
    setProgress({ current: 0, total: validFiles.length });

    const formData = new FormData();
    validFiles.forEach(f => formData.append("files", f));

    try {
      // We send all files at once
      setProgress({ current: 1, total: validFiles.length });

      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.results) {
        setResults(data.results);
        setProgress({ current: validFiles.length, total: validFiles.length });
      } else {
        setResults([{ file: "Upload", status: "error", error: data.error || "Upload failed" }]);
      }
    } catch {
      setResults([{ file: "Upload", status: "error", error: "Network error" }]);
    } finally {
      setUploading(false);
      setShowResults(true);
      onUploadComplete();
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return { bg: "var(--green-light)", color: "var(--green)" };
    if (confidence >= 0.65) return { bg: "var(--amber-light)", color: "var(--amber)" };
    return { bg: "var(--red-light)", color: "var(--red)" };
  };

  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Drop zone */}
      {!showResults && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer"
          style={{
            borderColor: isDragging ? "var(--blue)" : "var(--gray-200)",
            background: isDragging ? "var(--blue-light)" : "transparent",
            opacity: uploading ? 0.6 : 1,
            pointerEvents: uploading ? "none" : "auto",
          }}
        >
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="h-10 w-10 mx-auto animate-spin" style={{ color: "var(--blue)" }} />
              <p className="font-semibold" style={{ color: "var(--navy)" }}>{t.analyzing}</p>
              <p className="text-sm" style={{ color: "var(--gray-400)" }}>{t.analyzing_sub}</p>
              <p className="text-xs font-medium" style={{ color: "var(--blue)" }}>
                {t.processing} {progress.current} {t.of} {progress.total}
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--gray-400)" }} />
              <p className="font-semibold" style={{ color: "var(--navy)" }}>{t.dropzone}</p>
              <p className="text-sm mt-1" style={{ color: "var(--gray-400)" }}>{t.subtitle}</p>
              <p className="text-xs mt-2" style={{ color: "var(--gray-400)" }}>{t.formats}</p>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {showResults && results.length > 0 && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center gap-4 p-3 rounded-lg" style={{ background: "var(--gray-50)" }}>
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4" style={{ color: "var(--green)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--green)" }}>{successCount} {t.done}</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5">
                <X className="h-4 w-4" style={{ color: "var(--red)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--red)" }}>{errorCount} errors</span>
              </div>
            )}
          </div>

          {/* Individual results */}
          {results.map((result, i) => {
            const docType = result.classification?.type || "other";
            const Icon = FILE_TYPE_ICONS[docType] || FileText;
            const typeLabel = FILE_TYPE_LABELS[docType]?.[lang] || docType;
            const confidence = result.classification?.confidence || 0;
            const confColor = getConfidenceColor(confidence);

            return (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "white", boxShadow: "var(--shadow-sm)" }}
              >
                {/* Icon */}
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--blue-light)" }}>
                  <Icon className="h-4 w-4" style={{ color: "var(--blue)" }} />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--navy)" }}>{result.file}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Type badge */}
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                      {typeLabel}
                    </span>

                    {/* Confidence */}
                    {result.status === "success" && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: confColor.bg, color: confColor.color }}>
                        {Math.round(confidence * 100)}%
                      </span>
                    )}

                    {/* Match status */}
                    {result.status === "success" && result.candidate ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--green)" }}>
                        <Check className="h-3 w-3" />
                        {result.classification?.type === "cv" ? t.new_candidate : t.matched}
                      </span>
                    ) : result.status === "success" && !result.candidate ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--amber)" }}>
                        <AlertTriangle className="h-3 w-3" />
                        {t.no_match}
                      </span>
                    ) : null}

                    {/* Error */}
                    {result.status === "error" && (
                      <span className="text-xs" style={{ color: "var(--red)" }}>{result.error}</span>
                    )}
                  </div>
                </div>

                {/* View button */}
                {result.file_url && (
                  <a href={result.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="rounded-lg text-xs gap-1">
                      <Eye className="h-3 w-3" /> {t.view}
                    </Button>
                  </a>
                )}
              </div>
            );
          })}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => { setShowResults(false); setResults([]); }}
            >
              {t.upload_more}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setShowResults(false)}
            >
              {t.close}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
