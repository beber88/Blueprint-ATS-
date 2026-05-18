"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Flag, Trash2, AlertTriangle, AlertCircle, Info, MessageCircleQuestion } from "lucide-react";
import { OpsCard, OpsPageShell } from "@/components/operations/page-shell";
import { useI18n } from "@/lib/i18n/context";

interface Warning {
  code: string;
  severity: "low" | "medium" | "high";
  field: string;
  message_en: string;
  message_he: string;
}

interface AiItem {
  issue?: string;
  project?: string | null;
  department?: string | null;
  person_responsible?: string | null;
  category?: string | null;
  deadline?: string | null;
  status?: string;
  priority?: string;
  next_action?: string | null;
  ceo_decision_needed?: boolean;
  missing_information?: string | null;
  attendance_status?: string | null;
}

interface AiOutput {
  report_date?: string;
  project_id?: string | null;
  confidence?: number;
  model?: string;
  notes?: string | null;
  items?: AiItem[];
  ceo_action_items?: AiItem[];
}

interface DraftQuestion {
  id: string;
  question_text: string;
  question_text_en: string | null;
  context_snippet: string | null;
  suggested_trigger: string | null;
  status: "pending" | "answered" | "dismissed";
}

interface Draft {
  id: string;
  source_text: string;
  ai_output_json: AiOutput;
  warnings_json: Warning[];
  questions_json: Array<{ question: string; question_en?: string; context_snippet?: string; suggested_trigger?: string }>;
  status: string;
}

// Category labels now come from i18n — see operations.category.* keys

const SEVERITY_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  high:   { bg: "#FBEAEA", fg: "#7A1F1F", border: "#A32D2D" },
  medium: { bg: "#FFF7E6", fg: "#7A5A1F", border: "#C9A84C" },
  low:    { bg: "#F0F0F0", fg: "#3A3A3A", border: "#8A7D6B" },
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "high") return <AlertCircle size={14} />;
  if (severity === "medium") return <AlertTriangle size={14} />;
  return <Info size={14} />;
}

export default function PreviewDraftPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams<{ draftId: string }>();
  const draftId = params.draftId;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Context questions
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [answerBusy, setAnswerBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    Promise.all([
      fetch(`/api/operations/drafts/${draftId}`).then((r) => r.json()),
      fetch(`/api/operations/context/questions?draft_id=${draftId}`).then((r) => r.json()),
    ])
      .then(([d, q]) => {
        if (d.draft) setDraft(d.draft);
        else toast.error(d.error || "Draft not found");
        setQuestions(q.questions || []);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [draftId]);

  const answerQuestion = async (qId: string) => {
    const text = answerTexts[qId];
    if (!text?.trim()) return;
    setAnswerBusy(qId);
    try {
      const res = await fetch(`/api/operations/context/questions/${qId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_text: text.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "failed");
      toast.success(locale === "he" ? "תשובה נשמרה — ידע חדש נוצר" : "Answer saved — new knowledge created");
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
      setAnswerTexts((prev) => { const n = { ...prev }; delete n[qId]; return n; });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setAnswerBusy(null);
    }
  };

  const dismissQuestion = async (qId: string) => {
    try {
      await fetch(`/api/operations/context/questions/${qId}/dismiss`, { method: "POST" });
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
    } catch {
      toast.error("Error");
    }
  };

  const patchDraft = (next: AiOutput) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/operations/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ai_output: next }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "save failed");
        setDraft((cur) =>
          cur ? { ...cur, ai_output_json: next, warnings_json: data.warnings } : cur
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "save failed");
      }
    }, 1500);
  };

  const updateField = (path: (string | number)[], value: unknown) => {
    if (!draft) return;
    const next: AiOutput = JSON.parse(JSON.stringify(draft.ai_output_json));
    let cursor: Record<string, unknown> | unknown[] = next as unknown as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = (cursor as Record<string, unknown> & unknown[])[path[i] as never] as
        | Record<string, unknown>
        | unknown[];
    }
    (cursor as Record<string, unknown>)[path[path.length - 1] as string] = value;
    setDraft({ ...draft, ai_output_json: next });
    patchDraft(next);
  };

  const doSave = async (flagForReview: boolean, force = false) => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/operations/drafts/${draftId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagForReview, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.highWarnings) {
          const ok = window.confirm(
            t("operations.preview.confirm_save_with_warnings").replace(
              "{n}",
              String(data.highWarnings)
            )
          );
          if (ok) return doSave(flagForReview, true);
          return;
        }
        throw new Error(data.error || "save failed");
      }
      toast.success(t("operations.preview.saved"));
      router.push(`/hr/operations/issues`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  };

  const doDiscard = async () => {
    if (!draft) return;
    if (!window.confirm(t("operations.preview.confirm_discard"))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/operations/drafts/${draftId}/discard`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "discard failed");
      toast.success(t("operations.preview.discarded"));
      router.push(`/hr/operations/intake`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "discard failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <OpsPageShell title={t("operations.preview.title")}>
        <Loader2 className="animate-spin" />
      </OpsPageShell>
    );
  }
  if (!draft) {
    return (
      <OpsPageShell title={t("operations.preview.title")}>
        <p>{t("operations.preview.not_found")}</p>
      </OpsPageShell>
    );
  }

  const ai = draft.ai_output_json;
  const items = ai.items || [];
  const grouped = items.reduce<Record<string, AiItem[]>>((acc, it) => {
    const cat = it.category || "other";
    (acc[cat] = acc[cat] || []).push(it);
    return acc;
  }, {});

  const editable = draft.status === "draft" || draft.status === "flagged";

  return (
    <OpsPageShell
      title={t("operations.preview.title")}
      subtitle={t("operations.preview.subtitle")}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 16 }}>
        {/* Left column: source text */}
        <OpsCard title={t("operations.preview.source")}>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.6,
              margin: 0,
              color: "var(--text-secondary)",
              maxHeight: "70vh",
              overflowY: "auto",
            }}
            dir={locale === "he" ? "rtl" : "ltr"}
          >
            {draft.source_text}
          </pre>
        </OpsCard>

        {/* Middle: extracted output, grouped + editable */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OpsCard title={t("operations.preview.metadata")}>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-secondary)" }}>
              {t("operations.preview.report_date")}
            </label>
            <input
              type="date"
              value={ai.report_date || ""}
              disabled={!editable}
              onChange={(e) => updateField(["report_date"], e.target.value)}
              style={{
                width: "100%",
                padding: 6,
                marginTop: 4,
                marginBottom: 10,
                border: "1px solid var(--border-primary)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                borderRadius: 6,
              }}
            />
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("operations.preview.confidence")}: {ai.confidence ? Math.round(ai.confidence * 100) + "%" : "—"}
              {" · "}
              {t("operations.preview.items")}: {items.length}
            </div>
          </OpsCard>

          {Object.entries(grouped).map(([cat, list]) => (
            <OpsCard key={cat} title={t("operations.category." + cat) || cat}>
              {list.map((it, idxInCat) => {
                const i = items.indexOf(it);
                return (
                  <div
                    key={i}
                    id={`field-items-${i}`}
                    style={{
                      paddingBottom: 10,
                      marginBottom: 10,
                      borderBottom: idxInCat < list.length - 1 ? "1px solid var(--border-light)" : "none",
                    }}
                  >
                    <input
                      type="text"
                      value={it.issue || ""}
                      disabled={!editable}
                      onChange={(e) => updateField(["items", i, "issue"], e.target.value)}
                      placeholder={t("operations.preview.issue_placeholder")}
                      style={{
                        width: "100%",
                        padding: 6,
                        border: "1px solid var(--border-primary)",
                        background: "var(--bg-input)",
                        color: "var(--text-primary)",
                        borderRadius: 6,
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <input
                        type="text"
                        value={it.project || ""}
                        disabled={!editable}
                        onChange={(e) => updateField(["items", i, "project"], e.target.value)}
                        placeholder={t("operations.preview.project")}
                        style={inputStyle}
                      />
                      <input
                        type="text"
                        value={it.person_responsible || ""}
                        disabled={!editable}
                        onChange={(e) => updateField(["items", i, "person_responsible"], e.target.value)}
                        placeholder={t("operations.preview.person")}
                        style={inputStyle}
                      />
                      <input
                        type="date"
                        value={it.deadline || ""}
                        disabled={!editable}
                        onChange={(e) => updateField(["items", i, "deadline"], e.target.value)}
                        style={inputStyle}
                      />
                      <select
                        value={it.priority || "medium"}
                        disabled={!editable}
                        onChange={(e) => updateField(["items", i, "priority"], e.target.value)}
                        style={inputStyle}
                      >
                        <option value="low">{t("operations.priority.low")}</option>
                        <option value="medium">{t("operations.priority.medium")}</option>
                        <option value="high">{t("operations.priority.high")}</option>
                        <option value="urgent">{t("operations.priority.urgent")}</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </OpsCard>
          ))}

          {editable && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => doSave(false)}
                disabled={saving}
                style={primaryButton}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {t("operations.preview.save")}
              </button>
              <button
                onClick={() => doSave(true)}
                disabled={saving}
                style={secondaryButton}
              >
                <Flag size={14} />
                {t("operations.preview.save_flag")}
              </button>
              <button
                onClick={doDiscard}
                disabled={saving}
                style={dangerButton}
              >
                <Trash2 size={14} />
                {t("operations.preview.discard")}
              </button>
            </div>
          )}
        </div>

        {/* Right column: warnings + questions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OpsCard title={t("operations.preview.warnings")}>
            {draft.warnings_json.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                {t("operations.preview.no_warnings")}
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {draft.warnings_json.map((w, i) => {
                  const c = SEVERITY_COLORS[w.severity] || SEVERITY_COLORS.low;
                  const msg = locale === "he" ? w.message_he : w.message_en;
                  return (
                    <li
                      key={i}
                      onClick={() => {
                        const m = w.field.match(/items\[(\d+)\]/);
                        if (m) document.getElementById(`field-items-${m[1]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      style={{
                        cursor: "pointer",
                        padding: 8,
                        borderRadius: 6,
                        background: c.bg,
                        color: c.fg,
                        border: `1px solid ${c.border}`,
                        fontSize: 12,
                        display: "flex",
                        gap: 6,
                        alignItems: "flex-start",
                      }}
                    >
                      <SeverityIcon severity={w.severity} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2 }}>
                          {w.code}
                        </div>
                        <div>{msg}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </OpsCard>

          {/* AI Questions panel */}
          {questions.length > 0 && (
            <OpsCard>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontWeight: 700, fontSize: 14 }}>
                <MessageCircleQuestion size={14} />
                {locale === "he" ? "שאלות AI" : "AI Questions"}
                <span style={{
                  background: "#D97706",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 7px",
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {questions.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {questions.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: "#FFFBEB",
                      border: "1px solid #F59E0B",
                      fontSize: 12,
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>
                      {q.question_text}
                    </p>
                    {q.question_text_en && q.question_text !== q.question_text_en && (
                      <p style={{ margin: 0, fontSize: 11, color: "#6B7280", marginBottom: 4 }}>
                        {q.question_text_en}
                      </p>
                    )}
                    {q.context_snippet && (
                      <p style={{
                        margin: "0 0 6px",
                        fontSize: 11,
                        fontFamily: "monospace",
                        background: "#F3F4F6",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}>
                        &ldquo;{q.context_snippet}&rdquo;
                      </p>
                    )}
                    {q.suggested_trigger && (
                      <span style={{
                        display: "inline-block",
                        fontSize: 10,
                        background: "#FDE68A",
                        borderRadius: 4,
                        padding: "1px 6px",
                        marginBottom: 6,
                      }}>
                        {q.suggested_trigger}
                      </span>
                    )}
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <input
                        type="text"
                        placeholder={locale === "he" ? "הקלד תשובה..." : "Type answer..."}
                        value={answerTexts[q.id] || ""}
                        onChange={(e) => setAnswerTexts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => answerQuestion(q.id)}
                        disabled={answerBusy === q.id || !answerTexts[q.id]?.trim()}
                        style={{
                          ...primaryButton,
                          padding: "4px 10px",
                          fontSize: 11,
                          opacity: answerBusy === q.id || !answerTexts[q.id]?.trim() ? 0.5 : 1,
                        }}
                      >
                        {answerBusy === q.id ? <Loader2 size={12} className="animate-spin" /> : (locale === "he" ? "ענה" : "Answer")}
                      </button>
                      <button
                        onClick={() => dismissQuestion(q.id)}
                        style={{
                          ...secondaryButton,
                          padding: "4px 10px",
                          fontSize: 11,
                        }}
                      >
                        {locale === "he" ? "התעלם" : "Dismiss"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </OpsCard>
          )}
        </div>
      </div>
    </OpsPageShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 6,
  border: "1px solid var(--border-primary)",
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  borderRadius: 6,
  fontSize: 12,
};

const primaryButton: React.CSSProperties = {
  padding: "10px 14px",
  background: "#C9A84C",
  color: "#1A1A1A",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "transparent",
  color: "var(--text-primary)",
  border: "1px solid var(--border-primary)",
};

const dangerButton: React.CSSProperties = {
  ...primaryButton,
  background: "transparent",
  color: "#A32D2D",
  border: "1px solid #A32D2D",
};
