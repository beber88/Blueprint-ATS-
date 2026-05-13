"use client";

import { ItemsListPage } from "@/components/operations/items-list-page";
import { useI18n } from "@/lib/i18n/context";

export default function IssuesPage() {
  const { t } = useI18n();
  return <ItemsListPage title={t("operations.nav.issues")} subtitle={t("operations.issues.subtitle")} defaultFilter={{ open_only: true }} />;
}
