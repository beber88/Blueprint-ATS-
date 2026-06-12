"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface HealthData {
  ok: boolean;
  last_success_at: string | null;
  failures_24h: { job_name: string; started_at: string; error: string | null }[];
  stuck: {
    reports_queued: number;
    reports_failed: number;
    emails_unprocessed: number;
  };
  pending_questions: number;
}

/**
 * Admin-only banner showing whether the background pipeline (email ingest,
 * report extraction, digests) is healthy — last successful run, failures in
 * the last 24h, and stuck item counts.
 */
export function SystemHealthStrip() {
  const { isAdmin } = useUser();
  const { t, locale } = useI18n();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/system/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHealth(d))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) return null;
  if (loading) {
    return (
      <div style={{ ...stripStyle, background: "var(--bg-secondary)" }}>
        <Loader2 size={14} className="animate-spin" />
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {t("operations.system_health.loading")}
        </span>
      </div>
    );
  }
  if (!health) return null;

  const stuckTotal =
    health.stuck.reports_queued +
    health.stuck.reports_failed +
    health.stuck.emails_unprocessed;
  const hasIssues = !health.ok || health.stuck.reports_failed > 0;

  const lastRun = health.last_success_at
    ? new Date(health.last_success_at).toLocaleString(
        locale === "he" ? "he-IL" : "en-US",
        { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      )
    : t("operations.system_health.never");

  if (!hasIssues) {
    return (
      <div style={{ ...stripStyle, background: "rgba(45,122,62,0.08)", border: "1px solid rgba(45,122,62,0.25)" }}>
        <CheckCircle2 size={14} style={{ color: "#2D7A3E", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
          {t("operations.system_health.ok")} — {t("operations.system_health.last_run")}: {lastRun}
          {health.stuck.reports_queued > 0 && (
            <span style={{ color: "var(--text-secondary)" }}>
              {" "}({health.stuck.reports_queued} {t("operations.system_health.in_queue")})
            </span>
          )}
        </span>
      </div>
    );
  }

  const failedJobs = Array.from(new Set(health.failures_24h.map((f) => f.job_name)));

  return (
    <div style={{ ...stripStyle, background: "rgba(163,45,45,0.08)", border: "1px solid rgba(163,45,45,0.3)" }}>
      <AlertTriangle size={14} style={{ color: "#A32D2D", flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
        <b>{t("operations.system_health.problems")}:</b>{" "}
        {failedJobs.length > 0 && (
          <>
            {t("operations.system_health.failures")}: {failedJobs.join(", ")}
            {stuckTotal > 0 ? " | " : ""}
          </>
        )}
        {stuckTotal > 0 && (
          <>
            {health.stuck.reports_queued > 0 &&
              `${health.stuck.reports_queued} ${t("operations.system_health.stuck_reports")} `}
            {health.stuck.reports_failed > 0 &&
              `${health.stuck.reports_failed} ${t("operations.system_health.failed_reports")} `}
            {health.stuck.emails_unprocessed > 0 &&
              `${health.stuck.emails_unprocessed} ${t("operations.system_health.stuck_emails")}`}
          </>
        )}
        <span style={{ color: "var(--text-secondary)" }}>
          {" "}| {t("operations.system_health.last_run")}: {lastRun}
        </span>
      </span>
    </div>
  );
}

const stripStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 8,
  marginBottom: 16,
};
