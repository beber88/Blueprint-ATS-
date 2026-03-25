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
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: "New",
    reviewed: "Reviewed",
    shortlisted: "Shortlisted",
    interview_scheduled: "Interview Scheduled",
    interviewed: "Interviewed",
    approved: "Approved",
    rejected: "Rejected",
    keep_for_future: "Keep for Future",
    active: "Active",
    paused: "Paused",
    closed: "Closed",
  };
  return labels[status] || status;
}
