"use client";

import { useEffect, useState } from "react";
import { FileText, Briefcase, Award, Eye, Download, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

type Lang = "he" | "en" | "tl";
type DocType = "cv" | "portfolio" | "certificate" | "reference_letter" | "id_document" | "cover_letter" | "other";

interface CandidateFile {
  id: string;
  file_name: string;
  file_type: DocType;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  ai_classification_confidence: number | null;
  ai_classification_reasoning: string | null;
  uploaded_at: string;
  metadata: Record<string, unknown>;
}

interface CandidateFilesProps {
  candidateId: string;
  lang?: Lang;
}

const TYPE_CONFIG: Record<DocType, { icon: typeof FileText; color: string; bg: string }> = {
  cv: { icon: FileText, color: "var(--brand-gold)", bg: "var(--bg-tertiary)" },
  portfolio: { icon: Briefcase, color: "var(--purple)", bg: "var(--purple-light)" },
  certificate: { icon: Award, color: "var(--green)", bg: "var(--green-light)" },
  reference_letter: { icon: FileText, color: "var(--amber)", bg: "var(--amber-light)" },
  id_document: { icon: FileText, color: "var(--text-secondary)", bg: "var(--bg-tertiary)" },
  cover_letter: { icon: FileText, color: "var(--teal)", bg: "var(--bg-tertiary)" },
  other: { icon: FileText, color: "var(--text-tertiary)", bg: "var(--bg-tertiary)" },
};

const TYPE_LABELS: Record<DocType, Record<Lang, string>> = {
  cv: { he: "קורות חיים", en: "CV", tl: "Resume" },
  portfolio: { he: "תיק עבודות", en: "Portfolio", tl: "Portfolio" },
  certificate: { he: "תעודה", en: "Certificate", tl: "Sertipiko" },
  reference_letter: { he: "המלצה", en: "Reference", tl: "Rekomendasyon" },
  id_document: { he: "תעודה מזהה", en: "ID Document", tl: "ID Document" },
  cover_letter: { he: "מכתב מקדים", en: "Cover Letter", tl: "Cover Letter" },
  other: { he: "אחר", en: "Other", tl: "Iba pa" },
};

const TEXTS = {
  he: { view: "צפה", download: "הורד", empty: "אין קבצים למועמד זה", title: "קבצים" },
  en: { view: "View", download: "Download", empty: "No files for this candidate", title: "Files" },
  tl: { view: "Tingnan", download: "I-download", empty: "Walang mga file para sa kandidatong ito", title: "Mga File" },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CandidateFiles({ candidateId, lang = "he" }: CandidateFilesProps) {
  const [files, setFiles] = useState<CandidateFile[]>([]);
  const [loading, setLoading] = useState(true);
  const t = TEXTS[lang] || TEXTS.he;

  useEffect(() => {
    fetch(`/api/candidates/${candidateId}/files`)
      .then(r => r.json())
      .then(data => setFiles(Array.isArray(data) ? data : data.files || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [candidateId]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-xl animate-pulse" style={{ background: "var(--bg-secondary)" }}>
            <div className="h-10 w-10 rounded-lg" style={{ background: "var(--border-primary)" }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded" style={{ background: "var(--border-primary)" }} />
              <div className="h-3 w-32 rounded" style={{ background: "var(--bg-tertiary)" }} />
            </div>
            <div className="h-8 w-16 rounded-lg" style={{ background: "var(--border-primary)" }} />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <FolderOpen className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--border-secondary)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-tertiary)" }}>{t.empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map(file => {
        const config = TYPE_CONFIG[file.file_type] || TYPE_CONFIG.other;
        const Icon = config.icon;
        const typeLabel = TYPE_LABELS[file.file_type]?.[lang] || file.file_type;
        const dateStr = new Date(file.uploaded_at).toLocaleDateString(
          lang === "he" ? "he-IL" : lang === "tl" ? "tl-PH" : "en-US",
          { year: "numeric", month: "short", day: "numeric" }
        );

        return (
          <div
            key={file.id}
            className="flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-[color:var(--bg-secondary)]"
            style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}
          >
            {/* Type icon */}
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: config.bg }}
            >
              <Icon className="h-5 w-5" style={{ color: config.color }} />
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {file.file_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ background: config.bg, color: config.color }}
                >
                  {typeLabel}
                </span>
                {file.file_size && (
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {formatFileSize(file.file_size)}
                  </span>
                )}
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {dateStr}
                </span>
                {file.ai_classification_confidence != null && (
                  <span className="text-xs" style={{
                    color: file.ai_classification_confidence >= 0.85 ? "var(--green)"
                      : file.ai_classification_confidence >= 0.65 ? "var(--amber)"
                      : "var(--red)",
                  }}>
                    {Math.round(file.ai_classification_confidence * 100)}%
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="rounded-lg text-xs gap-1 h-8">
                  <Eye className="h-3.5 w-3.5" /> {t.view}
                </Button>
              </a>
              <a href={file.file_url} download={file.file_name}>
                <Button variant="ghost" size="sm" className="rounded-lg text-xs gap-1 h-8">
                  <Download className="h-3.5 w-3.5" /> {t.download}
                </Button>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
