import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-yellow-100 text-yellow-800";
  if (score >= 40) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: "bg-gray-100 text-gray-800",
    reviewed: "bg-blue-100 text-blue-800",
    shortlisted: "bg-indigo-100 text-indigo-800",
    interview_scheduled: "bg-purple-100 text-purple-800",
    interviewed: "bg-violet-100 text-violet-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    keep_for_future: "bg-amber-100 text-amber-800",
    active: "bg-green-100 text-green-800",
    paused: "bg-yellow-100 text-yellow-800",
    closed: "bg-gray-100 text-gray-800",
    scored: "bg-electric-100 text-electric-800",
    sent: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: "חדש",
    reviewed: "נבדק",
    shortlisted: "ברשימה מצומצמת",
    interview_scheduled: "ראיון נקבע",
    interviewed: "רואיין",
    approved: "אושר",
    rejected: "נדחה",
    keep_for_future: "לשמור לעתיד",
    active: "פעיל",
    paused: "מושהה",
    closed: "סגור",
    cv_uploaded: "קורות חיים הועלו",
    ai_scored: "דירוג AI",
    candidate_created: "מועמד נוצר",
    message_sent: "הודעה נשלחה",
    message_failed: "שליחה נכשלה",
    status_changed: "סטטוס שונה",
    interview_completed: "ראיון הושלם",
    scored: "דורג",
    sent: "נשלח",
    failed: "נכשל",
  };
  return labels[status] || status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
