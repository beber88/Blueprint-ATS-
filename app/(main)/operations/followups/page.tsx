"use client";

import { ItemsListPage } from "@/components/operations/items-list-page";
import { useI18n } from "@/lib/i18n/context";

export default function FollowupsPage() {
  const { t } = useI18n();
  return (
    <ItemsListPage
      title={t("operations.nav.followups")}
      subtitle={t("operations.followups.subtitle")}
      defaultFilter={{ open_only: true }}
    />
  );
}
