"use client";

import { useState, useRef } from "react";
import { Sparkles, Search, X, Loader2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScoreBadge } from "@/components/shared/score-badge";
import { useI18n } from "@/lib/i18n/context";
import { getProfessionLabel } from "@/lib/i18n/profession-labels";
import Link from "next/link";
import type { Candidate } from "@/types";

interface SmartSearchProps {
  onClose?: () => void;
}

export function SmartSearch({ onClose }: SmartSearchProps) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(Candidate & { applications?: { ai_score: number | null; job?: { title: string } }[] }) [] | null>(null);
  const [summary, setSummary] = useState("");
  const [totalFound, setTotalFound] = useState(0);
  const [showSummary, setShowSummary] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholders: Record<string, string[]> = {
    he: [
      "תמצא לי את 10 האדריכלים הטובים ביותר",
      "מהנדסים עם יותר מ-5 שנות ניסיון",
      "מנהלי פרויקט מנוסים עם ציון AI גבוה",
      "פועלי בניין חדשים השבוע",
      "מי המועמד הכי מתאים לתפקיד מהנדס אזרחי?",
    ],
    en: [
      "Find me the top 10 architects",
      "Engineers with more than 5 years experience",
      "Experienced project managers with high AI score",
      "New construction workers this week",
      "Who is the best candidate for civil engineer?",
    ],
    tl: [
      "Hanapin ang top 10 architects",
      "Mga engineer na may higit sa 5 taon na karanasan",
      "Mga experienced project manager na may mataas na AI score",
    ],
  };

  const currentPlaceholders = placeholders[locale] || placeholders.en;
  const [placeholderIndex] = useState(() => Math.floor(Math.random() * currentPlaceholders.length));

  const handleSearch = async () => {
    if (!query.trim() || loading) return;

    setLoading(true);
    setResults(null);
    setSummary("");

    try {
      const res = await fetch("/api/candidates/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), locale }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSummary(data.error || t("common.error"));
        return;
      }

      setResults(data.candidates || []);
      setSummary(data.ai_summary || "");
      setTotalFound(data.total || 0);
      setShowSummary(true);
    } catch {
      setSummary(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
    if (e.key === "Escape") {
      if (results) {
        setResults(null);
        setSummary("");
      } else if (onClose) {
        onClose();
      }
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const avatarColors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
  ];

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const getTopScore = (candidate: Candidate & { applications?: { ai_score: number | null }[] }) => {
    const apps = candidate.applications || [];
    const scores = apps.map((a) => a.ai_score).filter((s): s is number => s !== null);
    return scores.length > 0 ? Math.max(...scores) : null;
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-md)", border: "1px solid var(--border-primary)" }}>
      {/* Search Input */}
      <div className="p-4" style={{ borderBottom: results ? "1px solid var(--border-primary)" : "none" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: "linear-gradient(135deg, var(--brand-gold), #F59E0B)" }}>
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentPlaceholders[placeholderIndex]}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-primary)",
              }}
              autoFocus
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="rounded-xl px-5 h-[46px]"
            style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="mr-2">
              {loading
                ? locale === "he" ? "מחפש..." : "Searching..."
                : locale === "he" ? "חפש" : "Search"}
            </span>
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Example queries */}
        {!results && !loading && (
          <div className="mt-3 flex flex-wrap gap-2">
            {currentPlaceholders.slice(0, 3).map((example, i) => (
              <button
                key={i}
                onClick={() => { setQuery(example); }}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors hover:opacity-80"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: "var(--brand-gold)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {locale === "he" ? "מנתח את הבקשה ומחפש מועמדים מתאימים..." : "Analyzing your request and searching for matching candidates..."}
          </p>
        </div>
      )}

      {/* AI Summary */}
      {summary && !loading && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: "var(--brand-gold)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {locale === "he" ? "סיכום AI" : "AI Summary"}
              </span>
              {results && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}>
                  {results.length} {locale === "he" ? `מתוך ${totalFound}` : `of ${totalFound}`}
                </span>
              )}
            </div>
            {showSummary ? <ChevronUp className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />}
          </button>
          {showSummary && (
            <div className="mt-2 p-4 rounded-lg text-sm whitespace-pre-wrap leading-relaxed" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
              {summary}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && !loading && (
        <div className="p-4">
          <div className="space-y-2">
            {results.map((candidate, index) => {
              const topScore = getTopScore(candidate);
              const cats = (candidate.job_categories || []).map((k) => getProfessionLabel(k, locale)).filter(Boolean);

              return (
                <Link key={candidate.id} href={`/candidates/${candidate.id}`}>
                  <div
                    className="flex items-center gap-4 p-3 rounded-lg transition-all hover:scale-[1.01] cursor-pointer"
                    style={{ background: "var(--bg-tertiary)", border: "1px solid transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand-gold)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                  >
                    {/* Rank */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: index < 3 ? "var(--brand-gold)" : "var(--bg-secondary)", color: index < 3 ? "#1A1A1A" : "var(--text-tertiary)" }}>
                      {index + 1}
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className={`text-xs font-medium ${getAvatarColor(candidate.full_name)}`}>
                        {getInitials(candidate.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>
                          {candidate.full_name}
                        </span>
                        <StatusBadge status={candidate.status} lang={locale} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {cats.length > 0 && (
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{cats.join(", ")}</span>
                        )}
                        {candidate.experience_years != null && candidate.experience_years > 0 && (
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            {candidate.experience_years} {locale === "he" ? "שנים" : "yrs"}
                          </span>
                        )}
                        {(candidate.skills || []).length > 0 && (
                          <span className="text-xs truncate max-w-[200px]" style={{ color: "var(--text-tertiary)" }}>
                            {(candidate.skills || []).slice(0, 3).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="shrink-0">
                      {topScore != null ? <ScoreBadge score={topScore} /> : (
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {locale === "he" ? "לא דורג" : "N/A"}
                        </span>
                      )}
                    </div>

                    <ExternalLink className="h-4 w-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* No Results */}
      {results && results.length === 0 && !loading && (
        <div className="p-8 text-center">
          <Search className="h-8 w-8 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {locale === "he" ? "לא נמצאו מועמדים מתאימים. נסה חיפוש אחר." : "No matching candidates found. Try a different search."}
          </p>
        </div>
      )}
    </div>
  );
}
