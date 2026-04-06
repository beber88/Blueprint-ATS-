"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import Link from "next/link";
import {
  Search, Loader2, Sparkles, MapPin, Briefcase, GraduationCap,
  Star, ChevronDown, ChevronUp, Award, User, Trophy, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

interface SearchResult {
  rank: number;
  ai_search_score: number;
  reasoning: string;
  strengths: string[];
  candidate: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    location: string | null;
    experience_years: number | null;
    skills: string[] | null;
    education: string | null;
    certifications: string[] | null;
    previous_roles: { title: string; company: string; duration: string }[] | null;
    job_categories: string[] | null;
    status: string;
    ai_total_score: number | null;
    verdict_recommendation: string | null;
    verdict_level: string | null;
    cv_file_url: string | null;
  };
}

interface SearchResponse {
  candidates: SearchResult[];
  total: number;
  total_found: number;
  ai_summary: string;
  search_params: {
    professions: string[];
    count: number;
  };
}

export default function AISearchPage() {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const labels = {
    he: {
      title: "חיפוש חכם",
      subtitle: "תאר מה אתה מחפש ואנחנו נמצא את המועמדים הטובים ביותר",
      placeholder: "למשל: תמצא לי את 10 האדריכלים הטובים ביותר במערכת...",
      searching: "מחפש ומדרג מועמדים...",
      results_title: "תוצאות חיפוש",
      found: "נמצאו",
      from: "מתוך",
      candidates_in_db: "מועמדים במסד הנתונים",
      ai_summary: "סיכום AI",
      experience: "ניסיון",
      years: "שנים",
      skills: "כישורים",
      education: "השכלה",
      certifications: "תעודות",
      previous_roles: "תפקידים קודמים",
      strengths: "חוזקות",
      ai_reasoning: "נימוק AI",
      ai_score: "ציון AI",
      view_profile: "צפה בפרופיל",
      no_results: "לא נמצאו תוצאות",
      try_again: "נסה חיפוש אחר",
      examples: [
        "תמצא לי 10 אדריכלים מורשים טובים",
        "5 מהנדסי קונסטרוקציה עם ניסיון של מעל 8 שנים",
        "מנהלי פרויקט עם ניסיון באוטוקאד",
        "את 3 המועמדים הטובים ביותר לתפקיד מפקח",
        "פועלי בניין עם ניסיון בברזל",
        "רואי חשבון עם ניסיון ב-ERP",
      ],
      example_title: "דוגמאות לחיפוש:",
      rank: "דירוג",
      match_score: "ציון התאמה",
      level: "רמה",
      recommendation: "המלצה",
    },
    en: {
      title: "Smart Search",
      subtitle: "Describe what you're looking for and we'll find the best candidates",
      placeholder: "e.g.: Find me the top 10 architects in the system...",
      searching: "Searching and ranking candidates...",
      results_title: "Search Results",
      found: "Found",
      from: "from",
      candidates_in_db: "candidates in database",
      ai_summary: "AI Summary",
      experience: "Experience",
      years: "years",
      skills: "Skills",
      education: "Education",
      certifications: "Certifications",
      previous_roles: "Previous Roles",
      strengths: "Strengths",
      ai_reasoning: "AI Reasoning",
      ai_score: "AI Score",
      view_profile: "View Profile",
      no_results: "No results found",
      try_again: "Try a different search",
      examples: [
        "Find me the top 10 licensed architects",
        "5 structural engineers with 8+ years experience",
        "Project managers with AutoCAD experience",
        "Best 3 candidates for foreman position",
        "Construction workers with iron experience",
        "Accountants with ERP experience",
      ],
      example_title: "Search examples:",
      rank: "Rank",
      match_score: "Match Score",
      level: "Level",
      recommendation: "Recommendation",
    },
    tl: {
      title: "Matalinong Paghahanap",
      subtitle: "Ilarawan kung ano ang hinahanap mo at hahanapin namin ang pinakamahusay na kandidato",
      placeholder: "Hal: Hanapin ang top 10 arkitekto sa sistema...",
      searching: "Naghahanap at nira-rank ang mga kandidato...",
      results_title: "Mga Resulta ng Paghahanap",
      found: "Nahanap",
      from: "mula sa",
      candidates_in_db: "kandidato sa database",
      ai_summary: "Buod ng AI",
      experience: "Karanasan",
      years: "taon",
      skills: "Kakayahan",
      education: "Edukasyon",
      certifications: "Sertipikasyon",
      previous_roles: "Mga Nakaraang Tungkulin",
      strengths: "Kalakasan",
      ai_reasoning: "Pangangatwiran ng AI",
      ai_score: "Marka ng AI",
      view_profile: "Tingnan ang Profile",
      no_results: "Walang nakitang resulta",
      try_again: "Subukan ang ibang paghahanap",
      examples: [
        "Hanapin ang top 10 lisensyadong arkitekto",
        "5 structural engineer na may 8+ taong karanasan",
        "Mga project manager na may AutoCAD experience",
        "Pinakamahusay na 3 kandidato para sa foreman",
        "Mga construction worker na may karanasan sa bakal",
        "Mga accountant na may ERP experience",
      ],
      example_title: "Mga halimbawa ng paghahanap:",
      rank: "Ranggo",
      match_score: "Marka ng Pagtutugma",
      level: "Antas",
      recommendation: "Rekomendasyon",
    },
  };
  const l = labels[locale] || labels.he;

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query.trim();
    if (!q || loading) return;
    setQuery(q);
    setLoading(true);
    setResults(null);
    setExpandedCards(new Set());

    try {
      const res = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, locale }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");

      setResults(data);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#C9A84C";
    if (score >= 40) return "#f59e0b";
    return "#ef4444";
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { bg: "linear-gradient(135deg, #C9A84C, #F5D77A)", icon: Trophy, color: "#1A1A1A" };
    if (rank === 2) return { bg: "linear-gradient(135deg, #94a3b8, #cbd5e1)", icon: Award, color: "#1A1A1A" };
    if (rank === 3) return { bg: "linear-gradient(135deg, #b45309, #d97706)", icon: Award, color: "#fff" };
    return { bg: "var(--bg-tertiary)", icon: Star, color: "var(--text-secondary)" };
  };

  const getRecommendationLabel = (rec: string | null) => {
    const map: Record<string, { he: string; en: string; tl: string; color: string }> = {
      HIRE: { he: "מומלץ לגיוס", en: "Hire", tl: "I-hire", color: "#22c55e" },
      HOLD: { he: "להמשך בדיקה", en: "Hold", tl: "I-hold", color: "#f59e0b" },
      REJECT: { he: "לא מומלץ", en: "Reject", tl: "I-reject", color: "#ef4444" },
      strong_yes: { he: "מומלץ מאוד", en: "Strong Yes", tl: "Lubos na Oo", color: "#22c55e" },
      yes: { he: "מומלץ", en: "Yes", tl: "Oo", color: "#86efac" },
      maybe: { he: "אולי", en: "Maybe", tl: "Siguro", color: "#f59e0b" },
      no: { he: "לא", en: "No", tl: "Hindi", color: "#ef4444" },
    };
    if (!rec || !map[rec]) return null;
    return { label: map[rec][locale] || map[rec].en, color: map[rec].color };
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-secondary)" }}>
      {/* Header */}
      <div
        className="border-b px-6 py-5"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
      >
        <div className="flex items-center gap-4 mb-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, var(--brand-gold), #8B5CF6)" }}
          >
            <Search className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {l.title}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              {l.subtitle}
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search
              className="absolute top-1/2 -translate-y-1/2 h-5 w-5"
              style={{ color: "var(--text-tertiary)", left: locale === "he" ? "auto" : "14px", right: locale === "he" ? "14px" : "auto" }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={l.placeholder}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm"
              style={{
                border: "2px solid var(--border-primary)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                paddingRight: locale === "he" ? "44px" : "16px",
                paddingLeft: locale === "he" ? "16px" : "44px",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--brand-gold)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-primary)"; }}
            />
          </div>
          <Button
            onClick={() => handleSearch()}
            disabled={!query.trim() || loading}
            className="h-12 px-6 rounded-xl text-sm font-medium gap-2"
            style={{ background: query.trim() ? "var(--brand-gold)" : "var(--border-primary)", color: "#fff" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? l.searching : l.title}
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Empty state - show examples */}
        {!results && !loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-3xl mb-6"
              style={{ background: "linear-gradient(135deg, var(--brand-gold), #8B5CF6)" }}
            >
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              {l.title}
            </h2>
            <p className="text-sm text-center max-w-lg mb-8" style={{ color: "var(--text-tertiary)" }}>
              {l.subtitle}
            </p>

            <div className="w-full max-w-2xl">
              <p className="text-xs font-medium mb-3" style={{ color: "var(--text-tertiary)" }}>
                {l.example_title}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {l.examples.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(example); handleSearch(example); }}
                    className="flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium transition-all hover:shadow-md text-start"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-primary)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand-gold)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-primary)"; }}
                  >
                    <Search className="h-4 w-4 shrink-0" style={{ color: "var(--brand-gold)" }} />
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative mb-6">
              <div
                className="h-20 w-20 rounded-3xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--brand-gold), #8B5CF6)" }}
              >
                <Loader2 className="h-10 w-10 text-white animate-spin" />
              </div>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {l.searching}
            </p>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div className="max-w-4xl mx-auto">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {l.results_title}
                </h2>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {l.found} {results.total} {l.from} {results.total_found} {l.candidates_in_db}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-xs gap-1.5"
                onClick={() => { setResults(null); setQuery(""); inputRef.current?.focus(); }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {l.try_again}
              </Button>
            </div>

            {/* AI Summary */}
            {results.ai_summary && (
              <div
                className="rounded-xl p-4 mb-5"
                style={{
                  background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(139,92,246,0.08))",
                  border: "1px solid rgba(201,168,76,0.2)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4" style={{ color: "var(--brand-gold)" }} />
                  <span className="text-xs font-bold" style={{ color: "var(--brand-gold)" }}>
                    {l.ai_summary}
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {results.ai_summary}
                </p>
              </div>
            )}

            {/* Candidate cards */}
            {results.candidates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{l.no_results}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.candidates.map((result) => {
                  const isExpanded = expandedCards.has(result.candidate.id);
                  const rankStyle = getRankBadge(result.rank);
                  const RankIcon = rankStyle.icon;
                  const recLabel = getRecommendationLabel(result.candidate.verdict_recommendation);

                  return (
                    <div
                      key={result.candidate.id}
                      className="rounded-xl overflow-hidden transition-all"
                      style={{
                        background: "var(--bg-card)",
                        border: result.rank <= 3 ? "1px solid rgba(201,168,76,0.3)" : "1px solid var(--border-primary)",
                        boxShadow: result.rank === 1 ? "0 4px 20px rgba(201,168,76,0.15)" : "var(--shadow-sm)",
                      }}
                    >
                      {/* Card header */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer"
                        onClick={() => toggleCard(result.candidate.id)}
                      >
                        {/* Rank badge */}
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: rankStyle.bg }}
                        >
                          {result.rank <= 3 ? (
                            <RankIcon className="h-5 w-5" style={{ color: rankStyle.color }} />
                          ) : (
                            <span className="text-sm font-bold" style={{ color: rankStyle.color }}>
                              {result.rank}
                            </span>
                          )}
                        </div>

                        {/* Candidate info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                              {result.candidate.full_name}
                            </h3>
                            {recLabel && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ background: recLabel.color + "20", color: recLabel.color }}
                              >
                                {recLabel.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                            {result.candidate.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {result.candidate.location}
                              </span>
                            )}
                            {result.candidate.experience_years != null && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" /> {result.candidate.experience_years} {l.years}
                              </span>
                            )}
                            {result.candidate.education && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]">
                                <GraduationCap className="h-3 w-3" /> {result.candidate.education}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-center">
                            <div
                              className="text-lg font-bold"
                              style={{ color: getScoreColor(result.ai_search_score) }}
                            >
                              {result.ai_search_score}
                            </div>
                            <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                              {l.match_score}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          ) : (
                            <ChevronDown className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                          )}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div
                          className="px-4 pb-4 pt-0"
                          style={{ borderTop: "1px solid var(--border-primary)" }}
                        >
                          {/* AI Reasoning */}
                          <div className="mt-3 mb-3">
                            <p className="text-xs font-medium mb-1" style={{ color: "var(--brand-gold)" }}>
                              {l.ai_reasoning}
                            </p>
                            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {result.reasoning}
                            </p>
                          </div>

                          {/* Strengths */}
                          {result.strengths.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                                {l.strengths}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {result.strengths.map((s, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2.5 py-1 rounded-lg"
                                    style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Skills */}
                          {result.candidate.skills && result.candidate.skills.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                                {l.skills}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {result.candidate.skills.slice(0, 12).map((skill, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-0.5 rounded-md"
                                    style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Previous roles */}
                          {result.candidate.previous_roles && result.candidate.previous_roles.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                                {l.previous_roles}
                              </p>
                              <div className="space-y-1">
                                {result.candidate.previous_roles.slice(0, 3).map((role, i) => (
                                  <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                    <span className="font-medium">{role.title}</span>
                                    {" - "}{role.company} ({role.duration})
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Certifications */}
                          {result.candidate.certifications && result.candidate.certifications.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                                {l.certifications}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {result.candidate.certifications.map((cert, i) => (
                                  <span
                                    key={i}
                                    className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1"
                                    style={{ background: "rgba(201,168,76,0.1)", color: "var(--brand-gold)" }}
                                  >
                                    <Award className="h-3 w-3" /> {cert}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* AI Scores row */}
                          <div
                            className="flex items-center gap-4 mt-3 pt-3"
                            style={{ borderTop: "1px solid var(--border-primary)" }}
                          >
                            {result.candidate.ai_total_score != null && (
                              <div className="text-xs">
                                <span style={{ color: "var(--text-tertiary)" }}>{l.ai_score}: </span>
                                <span className="font-bold" style={{ color: getScoreColor(result.candidate.ai_total_score) }}>
                                  {result.candidate.ai_total_score}/100
                                </span>
                              </div>
                            )}
                            {result.candidate.verdict_level && (
                              <div className="text-xs">
                                <span style={{ color: "var(--text-tertiary)" }}>{l.level}: </span>
                                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                                  {result.candidate.verdict_level}
                                </span>
                              </div>
                            )}
                            <div className="flex-1" />
                            <Link
                              href={`/candidates/${result.candidate.id}`}
                              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                              style={{ background: "var(--brand-gold)", color: "#fff" }}
                            >
                              <User className="h-3 w-3" />
                              {l.view_profile}
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
