"use client";

import { useI18n } from "@/lib/i18n/context";
import { EmployeeTimelineEvent } from "@/types/employees";
import { formatDateTime } from "@/lib/utils";
import {
  Clock,
  FileText,
  UserPlus,
  Briefcase,
  Building2,
  AlertCircle,
  Award,
  RefreshCw,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

const EVENT_ICON: Record<string, LucideIcon> = {
  employee_created: UserPlus,
  promoted_from_candidate: UserPlus,
  document_uploaded: FileText,
  document_deleted: FileText,
  position_changed: Briefcase,
  department_changed: Building2,
  status_changed: RefreshCw,
  disciplinary_action: AlertCircle,
  achievement_added: Award,
};

const EVENT_COLOR: Record<string, string> = {
  employee_created: "bg-emerald-100 text-emerald-700",
  promoted_from_candidate: "bg-emerald-100 text-emerald-700",
  document_uploaded: "bg-blue-100 text-blue-700",
  document_deleted: "bg-rose-100 text-rose-700",
  position_changed: "bg-violet-100 text-violet-700",
  department_changed: "bg-violet-100 text-violet-700",
  status_changed: "bg-amber-100 text-amber-700",
  disciplinary_action: "bg-rose-100 text-rose-700",
  achievement_added: "bg-amber-100 text-amber-700",
};

interface Props {
  events: EmployeeTimelineEvent[];
}

export function EmployeeTimeline({ events }: Props) {
  const { t } = useI18n();

  if (!events.length) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        <Clock className="mx-auto mb-3 h-8 w-8 opacity-40" />
        {t("employees.timeline.empty")}
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-s ps-6">
      {events.map((event) => {
        const Icon = EVENT_ICON[event.event_type] || Clock;
        const colorClass = EVENT_COLOR[event.event_type] || "bg-slate-100 text-slate-700";

        return (
          <li key={event.id} className="relative">
            <span
              className={`absolute -start-9 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background ${colorClass}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{event.title || event.event_type}</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(event.event_date)}
                </div>
              </div>
              {event.description && (
                <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
