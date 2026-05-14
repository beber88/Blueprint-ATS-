"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  message?: string;
  loading?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({ open, title, description, message, loading, onClose, onCancel, onConfirm }: Props) {
  const handleClose = onCancel || onClose || (() => {});
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent style={{ maxWidth: 400 }}>
        <DialogHeader>
          <DialogTitle>{title || t("common.confirm_delete_title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {message || description || t("common.confirm_delete_message")}
        </p>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleClose} className="rounded-lg">
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={loading} onClick={onConfirm} className="rounded-lg">
            {loading ? t("common.loading") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
