"use client";

import { ItemsListPage } from "@/components/operations/items-list-page";
import { useI18n } from "@/lib/i18n/context";

export default function MissingInfoPage() {
  const { t } = useI18n();
  return (
    <ItemsListPage
      title={t("operations.nav.missing_info")}
      subtitle={t("operations.missing_info.subtitle")}
      defaultFilter={{ has_missing_info: true, open_only: true }}
    />
  );
}
