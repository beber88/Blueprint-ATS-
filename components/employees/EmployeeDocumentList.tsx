"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/context";
import {
  DocumentType,
  EmployeeDocument,
  DOCUMENT_TYPE_LABEL_KEY,
} from "@/types/employees";
import { FileText, Upload, Trash2, Download, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const DOC_TYPES: DocumentType[] = [
  "contract",
  "id",
  "certificate",
  "payslip",
  "government",
  "warning",
  "achievement",
  "report",
  "attendance",
  "medical",
  "tax",
  "other",
];

interface Props {
  employeeId: string;
  documents: EmployeeDocument[];
  onChanged: () => void;
}

export function EmployeeDocumentList({ employeeId, documents, onChanged }: Props) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("contract");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", docType);
      fd.append("title", file.name);

      const res = await fetch(`/api/employees/${employeeId}/documents`, {
        method: "POST",
        body: fd,
      });
      if (res.status === 409) {
        toast.warning(t("employees.documents.duplicate"));
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t("employees.documents.upload_failed"));
        return;
      }
      toast.success(t("employees.documents.uploaded"));
      onChanged();
    } catch (err) {
      console.error(err);
      toast.error(t("employees.documents.upload_failed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm(t("employees.documents.confirm_delete"))) return;
    try {
      const res = await fetch(
        `/api/employees/${employeeId}/documents?documentId=${documentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error(t("employees.documents.delete_failed"));
        return;
      }
      toast.success(t("employees.documents.deleted"));
      onChanged();
    } catch (err) {
      console.error(err);
      toast.error(t("employees.documents.delete_failed"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("employees.documents.type")}
          </label>
          <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((dt) => (
                <SelectItem key={dt} value={dt}>
                  {t(DOCUMENT_TYPE_LABEL_KEY[dt])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("common.uploading")}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {t("employees.documents.upload")}
            </>
          )}
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
          {t("employees.documents.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30"
            >
              <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {doc.title || doc.original_filename}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">
                    {t(DOCUMENT_TYPE_LABEL_KEY[doc.document_type])}
                  </Badge>
                  <span>{formatDate(doc.created_at)}</span>
                  {doc.size_bytes != null && (
                    <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                  )}
                  {doc.original_language && doc.original_language !== "unknown" && (
                    <span className="uppercase">{doc.original_language}</span>
                  )}
                </div>
              </div>
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={t("common.download")}
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
              <button
                onClick={() => handleDelete(doc.id)}
                className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                title={t("common.delete")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
