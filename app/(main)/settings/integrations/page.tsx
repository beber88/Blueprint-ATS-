"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";
import { CheckCircle2, AlertCircle, Cloud, Loader2, LinkIcon, Unplug } from "lucide-react";
import { toast } from "sonner";

interface DriveStatus {
  connected: boolean;
  google_email?: string | null;
  scope?: string | null;
  last_refreshed_at?: string | null;
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <IntegrationsPageInner />
    </Suspense>
  );
}

function IntegrationsPageInner() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/drive/auth/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus({ connected: false });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (params.get("drive_connected") === "1") {
      toast.success(t("integrations.drive.connected_toast"));
    }
    const err = params.get("drive_error");
    if (err) {
      toast.error(`${t("integrations.drive.error_prefix")}: ${err}`);
    }
  }, [params, t]);

  const handleConnect = () => {
    window.location.href = "/api/drive/auth/start";
  };

  const handleDisconnect = async () => {
    if (!confirm(t("integrations.drive.confirm_disconnect"))) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/drive/auth/status", { method: "DELETE" });
      if (res.ok) {
        toast.success(t("integrations.drive.disconnected"));
        await fetchStatus();
      } else {
        toast.error(t("integrations.drive.disconnect_failed"));
      }
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("integrations.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("integrations.subtitle")}</p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Cloud className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium">{t("integrations.drive.title")}</h2>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : status?.connected ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">
                  <CheckCircle2 className="me-1 h-3 w-3" />
                  {t("integrations.drive.status_connected")}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-50 text-slate-700 ring-1 ring-slate-200/60">
                  {t("integrations.drive.status_disconnected")}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("integrations.drive.description")}
            </p>

            {status?.connected && status.google_email && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">{t("integrations.drive.connected_as")}: </span>
                <span className="font-medium">{status.google_email}</span>
              </div>
            )}

            <div className="mt-5 flex items-center gap-2">
              {!loading && !status?.connected && (
                <Button onClick={handleConnect}>
                  <LinkIcon className="me-2 h-4 w-4" />
                  {t("integrations.drive.connect")}
                </Button>
              )}
              {!loading && status?.connected && (
                <>
                  <Button asChild variant="outline">
                    <a href="/drive-sync">{t("integrations.drive.open_sync")}</a>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    <Unplug className="me-2 h-4 w-4" />
                    {disconnecting ? t("common.loading") : t("integrations.drive.disconnect")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>{t("integrations.drive.scope_label")}:</strong>{" "}
            {t("integrations.drive.scope_description")}
          </div>
        </div>
      </div>
    </div>
  );
}
