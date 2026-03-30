"use client";

import { useI18n } from "@/lib/i18n/context";

const statusStyles: Record<string, { bg: string; text: string }> = {
  new: { bg: "var(--status-new-bg)", text: "var(--status-new-text)" },
  reviewed: { bg: "var(--status-reviewed-bg)", text: "var(--status-reviewed-text)" },
  shortlisted: { bg: "var(--status-shortlisted-bg)", text: "var(--status-shortlisted-text)" },
  interview_scheduled: { bg: "var(--status-interview-bg)", text: "var(--status-interview-text)" },
  interviewed: { bg: "var(--status-interview-bg)", text: "var(--status-interview-text)" },
  approved: { bg: "var(--status-approved-bg)", text: "var(--status-approved-text)" },
  rejected: { bg: "var(--status-rejected-bg)", text: "var(--status-rejected-text)" },
  keep_for_future: { bg: "var(--status-future-bg)", text: "var(--status-future-text)" },
  scored: { bg: "var(--status-shortlisted-bg)", text: "var(--status-shortlisted-text)" },
  active: { bg: "var(--status-approved-bg)", text: "var(--status-approved-text)" },
  paused: { bg: "var(--status-shortlisted-bg)", text: "var(--status-shortlisted-text)" },
  closed: { bg: "var(--status-new-bg)", text: "var(--status-new-text)" },
};

const statusKeys: Record<string, string> = {
  new: "candidates.status.new",
  reviewed: "candidates.status.reviewed",
  shortlisted: "candidates.status.shortlisted",
  interview_scheduled: "candidates.status.interview_scheduled",
  interviewed: "candidates.status.interviewed",
  approved: "candidates.status.approved",
  rejected: "candidates.status.rejected",
  keep_for_future: "candidates.status.keep_for_future",
  scored: "candidates.status.scored",
  active: "jobs.status.active",
  paused: "jobs.status.paused",
  closed: "jobs.status.closed",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useI18n();
  const style = statusStyles[status] || { bg: "var(--status-new-bg)", text: "var(--status-new-text)" };
  const label = statusKeys[status] ? t(statusKeys[status]) : status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${className || ""}`}
      style={{ background: style.bg, color: style.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.text, opacity: 0.6 }} />
      {label}
    </span>
  );
}
