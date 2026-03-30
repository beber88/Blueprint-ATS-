"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FolderOpen, FileText, CheckCircle, AlertTriangle, XCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

interface UploadResult {
  fileName: string;
  status: "pending" | "uploading" | "success" | "duplicate" | "error" | "attached";
  candidateName?: string;
  suggestedJob?: string;
  confidence?: number;
  error?: string;
  existingName?: string;
  existingId?: string;
  documentType?: string;
  attachedTo?: string;
}

interface BulkUploadProps {
  onComplete: () => void;
  onClose: () => void;
}

export function BulkUpload({ onComplete, onClose }: BulkUploadProps) {
  const { locale } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ext && ["pdf", "doc", "docx"].includes(ext);
    }).slice(0, 50);
    setFiles(prev => [...prev, ...validFiles]);
  };

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
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    const batchId = `batch_${Date.now()}`;
    const uploadResults: UploadResult[] = files.map(f => ({
      fileName: f.name,
      status: "pending" as const,
    }));
    setResults(uploadResults);

    for (let i = 0; i < files.length; i++) {
      uploadResults[i].status = "uploading";
      setResults([...uploadResults]);

      const formData = new FormData();
      formData.append("file", files[i]);
      formData.append("batchId", batchId);

      try {
        const res = await fetch("/api/cv/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (res.status === 409 && data.duplicate) {
          uploadResults[i] = {
            ...uploadResults[i],
            status: "duplicate",
            existingName: data.existing_name,
            existingId: data.existing_id,
          };
        } else if (!res.ok) {
          uploadResults[i] = {
            ...uploadResults[i],
            status: "error",
            error: data.error || "Upload failed",
          };
        } else if (data.document_type && data.document_type !== "cv" && data.attached_to) {
          // Non-CV document attached to existing candidate
          uploadResults[i] = {
            ...uploadResults[i],
            status: "attached",
            documentType: data.document_type,
            attachedTo: data.attached_to.full_name,
            candidateName: data.attached_to.full_name,
          };
        } else if (data.document_type && data.document_type !== "cv" && data.unmatched) {
          // Non-CV but no matching candidate
          uploadResults[i] = {
            ...uploadResults[i],
            status: "error",
            documentType: data.document_type,
            error: data.message || "No matching candidate found",
          };
        } else {
          // CV successfully processed
          uploadResults[i] = {
            ...uploadResults[i],
            status: "success",
            candidateName: data.candidate?.full_name || data.parsed?.full_name,
            suggestedJob: data.parsed?.suggested_job_category || (data.parsed?.job_categories || [])[0],
            confidence: data.parsed?.suggested_job_confidence,
            documentType: "cv",
          };
        }
      } catch {
        uploadResults[i] = { ...uploadResults[i], status: "error", error: "Network error" };
      }
      setResults([...uploadResults]);
    }

    setUploading(false);
    setShowResults(true);
    onComplete();
  };

  const successCount = results.filter(r => r.status === "success").length;
  const attachedCount = results.filter(r => r.status === "attached").length;
  const dupCount = results.filter(r => r.status === "duplicate").length;
  const errorCount = results.filter(r => r.status === "error").length;

  const labels = {
    he: { title: "העלאה מרובה", files_btn: "בחר קבצים", folder_btn: "בחר תיקייה", drop: "גררו קבצים לכאן", selected: "קבצים נבחרו", start: "התחל העלאה", uploading: "מעלה...", summary: "סיכום העלאה", success: "הועלו בהצלחה", duplicates: "כפילויות", errors: "שגיאות", close: "סגור", view: "צפה במועמדים", remove: "הסר", file: "קובץ", name: "שם שזוהה", category: "קטגוריה", confidence: "ביטחון", status: "סטטוס", already_exists: "כבר קיים", of: "מתוך" },
    en: { title: "Bulk Upload", files_btn: "Select Files", folder_btn: "Select Folder", drop: "Drop files here", selected: "files selected", start: "Start Upload", uploading: "Uploading...", summary: "Upload Summary", success: "Uploaded", duplicates: "Duplicates", errors: "Errors", close: "Close", view: "View Candidates", remove: "Remove", file: "File", name: "Detected Name", category: "Category", confidence: "Confidence", status: "Status", already_exists: "Already exists", of: "of" },
    tl: { title: "Bulk Upload", files_btn: "Pumili ng Files", folder_btn: "Pumili ng Folder", drop: "I-drop ang files dito", selected: "files napili", start: "Simulan ang Upload", uploading: "Nag-a-upload...", summary: "Buod ng Upload", success: "Na-upload", duplicates: "Mga Duplicate", errors: "Mga Error", close: "Isara", view: "Tingnan ang Kandidato", remove: "Alisin", file: "File", name: "Nakitang Pangalan", category: "Kategorya", confidence: "Kumpiyansa", status: "Status", already_exists: "Umiiral na", of: "sa" },
  };
  const l = labels[locale] || labels.he;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-md)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border-primary)" }}>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{l.title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[color:var(--bg-tertiary)]"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!showResults ? (
            <>
              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="border-2 border-dashed rounded-xl p-10 text-center transition-all"
                style={{
                  borderColor: isDragging ? "var(--brand-gold)" : "var(--border-primary)",
                  background: isDragging ? "var(--bg-tertiary)" : "transparent",
                }}
              >
                <Upload className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
                <p className="font-medium" style={{ color: "var(--text-primary)" }}>{l.drop}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>PDF, DOC, DOCX (max 50)</p>
                <div className="flex gap-3 justify-center mt-4">
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" multiple className="hidden" onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} />
                  <input ref={folderInputRef} type="file" accept=".pdf,.doc,.docx" multiple className="hidden" onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }} {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} />
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="rounded-lg"><FileText className="h-4 w-4 ml-2" />{l.files_btn}</Button>
                  <Button onClick={() => folderInputRef.current?.click()} variant="outline" className="rounded-lg"><FolderOpen className="h-4 w-4 ml-2" />{l.folder_btn}</Button>
                </div>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{files.length} {l.selected}</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-secondary)" }}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          <span style={{ color: "var(--text-primary)" }}>{f.name}</span>
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{(f.size / 1024).toFixed(0)}KB</span>
                        </div>
                        {!uploading && <button onClick={() => removeFile(i)} className="text-[color:var(--text-tertiary)] hover:text-red-500"><X className="h-4 w-4" /></button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload progress */}
              {uploading && results.length > 0 && (
                <div className="space-y-1">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-secondary)" }}>
                      {r.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--brand-gold)" }} />}
                      {r.status === "success" && <CheckCircle className="h-4 w-4" style={{ color: "var(--green)" }} />}
                      {r.status === "attached" && <CheckCircle className="h-4 w-4" style={{ color: "var(--brand-gold)" }} />}
                      {r.status === "duplicate" && <AlertTriangle className="h-4 w-4" style={{ color: "var(--amber)" }} />}
                      {r.status === "error" && <XCircle className="h-4 w-4" style={{ color: "var(--red)" }} />}
                      {r.status === "pending" && <div className="h-4 w-4 rounded-full" style={{ background: "var(--border-primary)" }} />}
                      <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{r.fileName}</span>
                      {r.candidateName && <span className="text-xs" style={{ color: "var(--green)" }}>{r.candidateName}</span>}
                      {r.existingName && <span className="text-xs" style={{ color: "var(--amber)" }}>{l.already_exists}: {r.existingName}</span>}
                      {r.error && <span className="text-xs" style={{ color: "var(--red)" }}>{r.error}</span>}
                    </div>
                  ))}
                  <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(results.filter(r => r.status !== "pending" && r.status !== "uploading").length / results.length) * 100}%`, background: "var(--brand-gold)" }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Results summary */
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-4 rounded-xl text-center" style={{ background: "var(--green-light)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--green)" }}>{successCount}</p>
                  <p className="text-xs font-medium" style={{ color: "var(--green)" }}>{l.success}</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-tertiary)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--brand-gold)" }}>{attachedCount}</p>
                  <p className="text-xs font-medium" style={{ color: "var(--brand-gold)" }}>{locale === "he" ? "צורפו לתיק" : "Attached"}</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: "var(--amber-light)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--amber)" }}>{dupCount}</p>
                  <p className="text-xs font-medium" style={{ color: "var(--amber)" }}>{l.duplicates}</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: "var(--red-light)" }}>
                  <p className="text-2xl font-bold" style={{ color: "var(--red)" }}>{errorCount}</p>
                  <p className="text-xs font-medium" style={{ color: "var(--red)" }}>{l.errors}</p>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{l.file}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{l.name}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{l.category}</th>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>{l.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--bg-tertiary)" }}>
                      <td className="px-3 py-2 truncate max-w-[150px]">{r.fileName}</td>
                      <td className="px-3 py-2">{r.candidateName || r.existingName || "-"}</td>
                      <td className="px-3 py-2">{r.suggestedJob ? `${r.suggestedJob} (${r.confidence}%)` : "-"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{
                          background: r.status === "success" ? "var(--green-light)" : r.status === "duplicate" ? "var(--amber-light)" : "var(--red-light)",
                          color: r.status === "success" ? "var(--green)" : r.status === "duplicate" ? "var(--amber)" : "var(--red)",
                        }}>
                          {r.status === "success" ? "✓" : r.status === "duplicate" ? "⚠" : "✗"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
          {!showResults ? (
            <>
              <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{files.length} {l.selected}</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="rounded-lg">{l.close}</Button>
                <Button onClick={startUpload} disabled={files.length === 0 || uploading} className="rounded-lg text-white" style={{ background: "var(--brand-gold)" }}>
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />{l.uploading}</> : l.start}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={onClose} className="rounded-lg">{l.close}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
