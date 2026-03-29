"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  new: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  reviewed: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  shortlisted: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  interview_scheduled: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  interviewed: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  approved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  rejected: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  keep_for_future: { bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  scored: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  active: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  paused: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  closed: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
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
  const style = statusStyles[status] || { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" };
  const label = statusKeys[status] ? t(statusKeys[status]) : status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        style.bg,
        style.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {label}
    </span>
  );
}
