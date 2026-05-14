"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/context";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ContractFull {
  id: string;
  category: string;
  counterparty_name: string;
  counterparty_contact_name: string | null;
  counterparty_contact_email: string | null;
  counterparty_contact_phone: string | null;
  project_id: string | null;
  title: string;
  summary: string | null;
  signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  monetary_value: number | null;
  currency: string | null;
  is_renewable: boolean;
  status: string;
  storage_path: string | null;
  flagged_for_review: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  open: boolean;
  contract: ContractFull;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditContractDialog({ open, contract, onClose, onUpdated }: Props) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "customer",
    counterparty_name: "",
    counterparty_contact_name: "",
    counterparty_contact_email: "",
    counterparty_contact_phone: "",
    signing_date: "",
    effective_date: "",
    expiration_date: "",
    renewal_date: "",
    monetary_value: "",
    currency: "",
    is_renewable: false,
    status: "draft",
    summary: "",
    flagged_for_review: false,
  });

  useEffect(() => {
    if (open && contract) {
      setForm({
        title: contract.title || "",
        category: contract.category || "customer",
        counterparty_name: contract.counterparty_name || "",
        counterparty_contact_name: contract.counterparty_contact_name || "",
        counterparty_contact_email: contract.counterparty_contact_email || "",
        counterparty_contact_phone: contract.counterparty_contact_phone || "",
        signing_date: contract.signing_date || "",
        effective_date: contract.effective_date || "",
        expiration_date: contract.expiration_date || "",
        renewal_date: contract.renewal_date || "",
        monetary_value: contract.monetary_value != null ? String(contract.monetary_value) : "",
        currency: contract.currency || "",
        is_renewable: contract.is_renewable,
        status: contract.status || "draft",
        summary: contract.summary || "",
        flagged_for_review: contract.flagged_for_review,
      });
    }
  }, [open, contract]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        category: form.category,
        counterparty_name: form.counterparty_name,
        counterparty_contact_name: form.counterparty_contact_name || null,
        counterparty_contact_email: form.counterparty_contact_email || null,
        counterparty_contact_phone: form.counterparty_contact_phone || null,
        signing_date: form.signing_date || null,
        effective_date: form.effective_date || null,
        expiration_date: form.expiration_date || null,
        renewal_date: form.renewal_date || null,
        monetary_value: form.monetary_value ? Number(form.monetary_value) : null,
        currency: form.currency || null,
        is_renewable: form.is_renewable,
        status: form.status,
        summary: form.summary || null,
        flagged_for_review: form.flagged_for_review,
      };
      const res = await fetch(`/api/contracts/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      toast.success(t("common.saved_successfully"));
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const isRTL = locale === "he";
  const dateStyle: React.CSSProperties = isRTL ? { direction: "ltr" } : {};

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: 600, maxHeight: "80vh", overflowY: "auto" }}>
        <DialogHeader>
          <DialogTitle>{t("common.edit")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>{t("contracts.detail.title")}</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div>
              <label style={labelStyle}>{t("contracts.list.filter_category")}</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={selectStyle}>
                <option value="customer">{t("contracts.category.customer")}</option>
                <option value="subcontractor">{t("contracts.category.subcontractor")}</option>
                <option value="vendor">{t("contracts.category.vendor")}</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>{t("contracts.list.filter_status")}</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={selectStyle}>
                <option value="draft">{t("contracts.status.draft")}</option>
                <option value="active">{t("contracts.status.active")}</option>
                <option value="expired">{t("contracts.status.expired")}</option>
                <option value="terminated">{t("contracts.status.terminated")}</option>
                <option value="renewed">{t("contracts.status.renewed")}</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>{t("contracts.detail.counterparty")}</label>
              <Input value={form.counterparty_name} onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })} />
            </div>

            <div>
              <label style={labelStyle}>Contact name</label>
              <Input value={form.counterparty_contact_name} onChange={(e) => setForm({ ...form, counterparty_contact_name: e.target.value })} />
            </div>

            <div>
              <label style={labelStyle}>Contact email</label>
              <Input type="email" value={form.counterparty_contact_email} onChange={(e) => setForm({ ...form, counterparty_contact_email: e.target.value })} />
            </div>

            <div>
              <label style={labelStyle}>Contact phone</label>
              <Input value={form.counterparty_contact_phone} onChange={(e) => setForm({ ...form, counterparty_contact_phone: e.target.value })} style={dateStyle} />
            </div>

            <div>
              <label style={labelStyle}>Signing date</label>
              <Input type="date" value={form.signing_date} onChange={(e) => setForm({ ...form, signing_date: e.target.value })} style={dateStyle} />
            </div>

            <div>
              <label style={labelStyle}>Effective date</label>
              <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} style={dateStyle} />
            </div>

            <div>
              <label style={labelStyle}>Expiration date</label>
              <Input type="date" value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} style={dateStyle} />
            </div>

            <div>
              <label style={labelStyle}>Renewal date</label>
              <Input type="date" value={form.renewal_date} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} style={dateStyle} />
            </div>

            <div>
              <label style={labelStyle}>{t("contracts.detail.value")}</label>
              <Input type="number" value={form.monetary_value} onChange={(e) => setForm({ ...form, monetary_value: e.target.value })} style={dateStyle} />
            </div>

            <div>
              <label style={labelStyle}>Currency</label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="USD" />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <input type="checkbox" checked={form.is_renewable} onChange={(e) => setForm({ ...form, is_renewable: e.target.checked })} id="is_renewable" />
              <label htmlFor="is_renewable" style={{ fontSize: 13, color: "var(--text-primary)" }}>Renewable</label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
              <input type="checkbox" checked={form.flagged_for_review} onChange={(e) => setForm({ ...form, flagged_for_review: e.target.checked })} id="flagged" />
              <label htmlFor="flagged" style={{ fontSize: 13, color: "var(--text-primary)" }}>Flagged for review</label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>{t("contracts.detail.summary")}</label>
              <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} />
            </div>
          </div>

          <DialogFooter style={{ marginTop: 16 }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : t("common.save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--text-secondary)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border-primary)",
  borderRadius: 6,
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  fontSize: 13,
};
