"use client";

import { ItemsListPage } from "@/components/operations/items-list-page";
import { useI18n } from "@/lib/i18n/context";

export default function ArchivePage() {
  const { t } = useI18n();
  return <ItemsListPage title={t("operations.nav.archive")} subtitle={t("operations.archive.subtitle")} />;
}
