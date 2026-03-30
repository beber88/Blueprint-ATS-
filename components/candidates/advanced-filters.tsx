"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { getProfessionLabel } from "@/lib/i18n/profession-labels";

interface FilterState {
  search: string;
  statuses: string[];
  professions: string[];
  min_experience: number | null;
  max_experience: number | null;
  min_score: number | null;
  max_score: number | null;
  has_portfolio: boolean | null;
  has_email: boolean | null;
  required_skills: string[];
  sort_by: string;
  sort_order: "asc" | "desc";
  page: number;
  per_page: number;
  preset: string | null;
}

interface AdvancedFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  total: number;
  lang: string;
}

const PRESETS = [
  { key: null, labelKey: "preset_all" },
  { key: "new_this_week", labelKey: "preset_new_week" },
  { key: "strong_candidates", labelKey: "preset_strong" },
  { key: "ready_for_interview", labelKey: "preset_ready_interview" },
  { key: "with_portfolio", labelKey: "preset_portfolio" },
  { key: "uncontacted", labelKey: "preset_uncontacted" },
];

const PROFESSIONS = [
  "architect",
  "architect_licensed",
  "architect_intern",
  "project_manager",
  "site_engineer",
  "engineer_civil",
  "engineer_mep",
  "engineer_electrical",
  "quantity_surveyor",
  "procurement",
  "foreman",
  "construction_worker",
  "marketing",
  "hr",
  "admin",
  "other",
];

const STATUSES = [
  "new",
  "reviewed",
  "shortlisted",
  "interview_scheduled",
  "interviewed",
  "approved",
  "rejected",
  "keep_for_future",
];

export function AdvancedFilters({
  filters,
  onChange,
  total,
  lang,
}: AdvancedFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const labels: Record<string, Record<string, string>> = {
    he: {
      search: "חיפוש לפי שם, אימייל או כישורים...",
      add_filter: "סינון מתקדם",
      clear_all: "נקה הכל",
      sort_by: "מיין לפי",
      showing: "מציג",
      of: "מתוך",
      candidates: "מועמדים",
      preset_all: "הכל",
      preset_new_week: "חדשים השבוע",
      preset_strong: "מועמדים חזקים",
      preset_ready_interview: "מוכנים לראיון",
      preset_portfolio: "עם תיק עבודות",
      preset_uncontacted: "לא נפנו",
      sort_date: "תאריך",
      sort_name: "שם",
      sort_score: "ציון AI",
      sort_experience: "ניסיון",
      filter_status: "סטטוס",
      filter_profession: "מקצוע",
      filter_experience: "ניסיון",
      filter_score: "ציון AI",
      filter_portfolio: "תיק עבודות",
      per_page: "לעמוד",
      min: "מינימום",
      max: "מקסימום",
      yes: "כן",
      no: "לא",
    },
    en: {
      search: "Search by name, email or skills...",
      add_filter: "Advanced filters",
      clear_all: "Clear all",
      sort_by: "Sort by",
      showing: "Showing",
      of: "of",
      candidates: "candidates",
      preset_all: "All",
      preset_new_week: "New this week",
      preset_strong: "Strong candidates",
      preset_ready_interview: "Ready for interview",
      preset_portfolio: "With portfolio",
      preset_uncontacted: "Uncontacted",
      sort_date: "Date",
      sort_name: "Name",
      sort_score: "AI Score",
      sort_experience: "Experience",
      filter_status: "Status",
      filter_profession: "Profession",
      filter_experience: "Experience",
      filter_score: "AI Score",
      filter_portfolio: "Portfolio",
      per_page: "per page",
      min: "Min",
      max: "Max",
      yes: "Yes",
      no: "No",
    },
    tl: {
      search: "Maghanap ayon sa pangalan, email o kasanayan...",
      add_filter: "Advanced filters",
      clear_all: "I-clear lahat",
      sort_by: "Ayusin ayon sa",
      showing: "Ipinapakita",
      of: "sa",
      candidates: "kandidato",
      preset_all: "Lahat",
      preset_new_week: "Bago ngayong linggo",
      preset_strong: "Malalakas",
      preset_ready_interview: "Handa sa panayam",
      preset_portfolio: "May portfolio",
      preset_uncontacted: "Hindi pa na-contact",
      sort_date: "Petsa",
      sort_name: "Pangalan",
      sort_score: "AI Score",
      sort_experience: "Karanasan",
      filter_status: "Status",
      filter_profession: "Propesyon",
      filter_experience: "Karanasan",
      filter_score: "AI Score",
      filter_portfolio: "Portfolio",
      per_page: "bawat pahina",
      min: "Min",
      max: "Max",
      yes: "Oo",
      no: "Hindi",
    },
  };
  const l = labels[lang] || labels.en;

  const activeCount = [
    filters.statuses.length > 0,
    filters.professions.length > 0,
    filters.min_experience != null,
    filters.max_experience != null,
    filters.min_score != null,
    filters.max_score != null,
    filters.has_portfolio != null,
    filters.has_email != null,
    filters.required_skills.length > 0,
  ].filter(Boolean).length;

  const updateFilter = (key: string, value: unknown) => {
    onChange({ ...filters, [key]: value, page: 1, preset: null });
  };

  const clearAll = () => {
    onChange({
      search: "",
      statuses: [],
      professions: [],
      min_experience: null,
      max_experience: null,
      min_score: null,
      max_score: null,
      has_portfolio: null,
      has_email: null,
      required_skills: [],
      sort_by: "created_at",
      sort_order: "desc",
      page: 1,
      per_page: 50,
      preset: null,
    });
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: "var(--text-tertiary)" }}
        />
        <Input
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          placeholder={l.search}
          className="pr-10 h-11 rounded-lg"
          style={{
            borderColor: "var(--border-primary)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Quick presets */}
      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.key || "all"}
            onClick={() => onChange({ ...filters, preset: p.key, page: 1 })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background:
                filters.preset === p.key
                  ? "var(--brand-gold)"
                  : "var(--bg-tertiary)",
              color:
                filters.preset === p.key
                  ? "#1A1A1A"
                  : "var(--text-secondary)",
            }}
          >
            {l[p.labelKey]}
          </button>
        ))}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
          style={{
            background:
              activeCount > 0 ? "var(--brand-gold)" : "var(--bg-tertiary)",
            color: activeCount > 0 ? "#1A1A1A" : "var(--text-secondary)",
          }}
        >
          <SlidersHorizontal className="h-3 w-3" />
          {l.add_filter}
          {activeCount > 0 && (
            <span
              className="px-1 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(0,0,0,0.15)" }}
            >
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
        </button>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X className="inline h-3 w-3" /> {l.clear_all}
          </button>
        )}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl"
          style={{
            background: "var(--bg-secondary)",
            border: "0.5px solid var(--border-primary)",
          }}
        >
          {/* Status */}
          <div>
            <label
              className="text-[10px] uppercase tracking-wider font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {l.filter_status}
            </label>
            <Select
              value={filters.statuses[0] || "all"}
              onValueChange={(v) =>
                updateFilter("statuses", v === "all" ? [] : [v])
              }
            >
              <SelectTrigger
                className="h-8 mt-1 rounded-lg text-xs"
                style={{ borderColor: "var(--border-primary)" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{l.preset_all}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profession */}
          <div>
            <label
              className="text-[10px] uppercase tracking-wider font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {l.filter_profession}
            </label>
            <Select
              value={filters.professions[0] || "all"}
              onValueChange={(v) =>
                updateFilter("professions", v === "all" ? [] : [v])
              }
            >
              <SelectTrigger
                className="h-8 mt-1 rounded-lg text-xs"
                style={{ borderColor: "var(--border-primary)" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{l.preset_all}</SelectItem>
                {PROFESSIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {getProfessionLabel(p, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Experience range */}
          <div>
            <label
              className="text-[10px] uppercase tracking-wider font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {l.filter_experience}
            </label>
            <div className="flex gap-1 mt-1">
              <Input
                type="number"
                placeholder={l.min}
                className="h-8 text-xs rounded-lg w-full"
                style={{ borderColor: "var(--border-primary)" }}
                value={filters.min_experience ?? ""}
                onChange={(e) =>
                  updateFilter(
                    "min_experience",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
              <Input
                type="number"
                placeholder={l.max}
                className="h-8 text-xs rounded-lg w-full"
                style={{ borderColor: "var(--border-primary)" }}
                value={filters.max_experience ?? ""}
                onChange={(e) =>
                  updateFilter(
                    "max_experience",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </div>
          </div>

          {/* Score range */}
          <div>
            <label
              className="text-[10px] uppercase tracking-wider font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {l.filter_score}
            </label>
            <div className="flex gap-1 mt-1">
              <Input
                type="number"
                placeholder="0"
                className="h-8 text-xs rounded-lg w-full"
                style={{ borderColor: "var(--border-primary)" }}
                value={filters.min_score ?? ""}
                onChange={(e) =>
                  updateFilter(
                    "min_score",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
              <Input
                type="number"
                placeholder="100"
                className="h-8 text-xs rounded-lg w-full"
                style={{ borderColor: "var(--border-primary)" }}
                value={filters.max_score ?? ""}
                onChange={(e) =>
                  updateFilter(
                    "max_score",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Sort + count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {l.sort_by}:
          </span>
          <Select
            value={filters.sort_by}
            onValueChange={(v) => updateFilter("sort_by", v)}
          >
            <SelectTrigger
              className="h-7 rounded-md text-xs w-32"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">{l.sort_date}</SelectItem>
              <SelectItem value="full_name">{l.sort_name}</SelectItem>
              <SelectItem value="overall_ai_score">{l.sort_score}</SelectItem>
              <SelectItem value="experience_years">
                {l.sort_experience}
              </SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() =>
              updateFilter(
                "sort_order",
                filters.sort_order === "asc" ? "desc" : "asc"
              )
            }
            className="text-xs px-2 py-1 rounded"
            style={{ color: "var(--text-tertiary)" }}
          >
            {filters.sort_order === "asc" ? "\u2191" : "\u2193"}
          </button>
        </div>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {total} {l.candidates}
        </span>
      </div>
    </div>
  );
}
