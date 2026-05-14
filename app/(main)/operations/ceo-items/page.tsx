"use client";

import { ItemsListPage } from "@/components/operations/items-list-page";
import { useI18n } from "@/lib/i18n/context";

export default function CEOItemsPage() {
  const { t } = useI18n();
  return (
    <ItemsListPage
      title={t("operations.nav.ceo_items")}
      subtitle={t("operations.ceo_items.subtitle")}
      defaultFilter={{ ceo_decision_needed: true, open_only: true }}
    />
  );
}
