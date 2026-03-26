import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  new: { label: "חדש", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  reviewed: { label: "נבדק", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  shortlisted: { label: "ברשימה מצומצמת", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  interview_scheduled: { label: "ראיון נקבע", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  interviewed: { label: "רואיין", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  approved: { label: "אושר", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  rejected: { label: "נדחה", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  keep_for_future: { label: "לשמור לעתיד", bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500" },
  scored: { label: "דורג", bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  active: { label: "פעיל", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  paused: { label: "מושהה", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  closed: { label: "סגור", bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
