import { createAdminClient } from "@/lib/supabase/admin";
import type { ContextEntry, ContextEntryType } from "@/lib/operations/types";

const MAX_ENTRIES = 100;

const TYPE_LABELS: Record<ContextEntryType, string> = {
  abbreviation: "Abbreviations",
  entity_mapping: "Entity Mappings",
  project_phase: "Project Phases",
  pattern: "Recurring Patterns",
  general: "General Knowledge",
};

/**
 * Load active context entries and format them as a prompt block for Claude.
 * Optionally scoped to a specific project.
 */
export async function loadContextBlock(
  projectId?: string | null
): Promise<string> {
  const supabase = createAdminClient();

  let query = supabase
    .from("op_context_entries")
    .select("*")
    .eq("is_active", true)
    .order("usage_count", { ascending: false })
    .limit(MAX_ENTRIES);

  // Include entries scoped to this project OR globally scoped (null project)
  if (projectId) {
    query = query.or(`scope_project_id.is.null,scope_project_id.eq.${projectId}`);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) return "";

  // Group by type
  const grouped: Record<string, ContextEntry[]> = {};
  for (const entry of data as ContextEntry[]) {
    const key = entry.entry_type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }

  const lines: string[] = [];
  for (const [type, entries] of Object.entries(grouped)) {
    const label = TYPE_LABELS[type as ContextEntryType] || type;
    lines.push(`## ${label}`);
    for (const e of entries) {
      const scope = e.scope_project_id ? " (project-specific)" : "";
      lines.push(`- "${e.trigger_text}" → ${e.resolution}${scope}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * After extraction, bump usage_count for entries whose trigger_text
 * appears in the report text. Fire-and-forget.
 */
export async function trackContextUsage(reportText: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("op_context_entries")
    .select("id, trigger_text")
    .eq("is_active", true);

  if (!data || data.length === 0) return;

  const lower = reportText.toLowerCase();
  const usedIds = data
    .filter((e) => lower.includes(e.trigger_text.toLowerCase()))
    .map((e) => e.id);

  if (usedIds.length === 0) return;

  // Batch update — fire-and-forget, but failures must be visible in logs.
  await Promise.all(
    usedIds.map((id) =>
      supabase.rpc("increment_context_usage", { entry_id: id }).then(
        ({ error }) => {
          if (error) console.error("trackContextUsage: rpc failed", id, error);
        },
        (err) => console.error("trackContextUsage: rpc rejected", id, err)
      )
    )
  );
}
