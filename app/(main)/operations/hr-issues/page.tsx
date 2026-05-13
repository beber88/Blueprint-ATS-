"use client";

import { ItemsListPage } from "@/components/operations/items-list-page";
import { useI18n } from "@/lib/i18n/context";

export default function HRIssuesPage() {
  const { t } = useI18n();
  return (
    <ItemsListPage
      title={t("operations.nav.hr_issues")}
      subtitle={t("operations.hr_issues.subtitle")}
      defaultFilter={{ category: "hr", priority: "urgent", open_only: true }}
    />
  );
}
