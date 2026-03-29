"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/context";
import { Bot, Send, User, Sparkles, Users, Briefcase, TrendingUp, Calendar, Loader2, GitCompare, UserSearch, FileText, X, Check } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface CandidateItem {
  id: string;
  full_name: string;
  email: string;
  status: string;
  job_categories?: string[];
}

export default function AIAgentPage() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/candidates?limit=200").then(r => r.json()).then(d => setCandidates(d.candidates || [])).catch(() => {});
  }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMessage: Message = { role: "user", content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
          candidateIds: selectedCandidates.length > 0 ? selectedCandidates : undefined,
          mode: selectedCandidates.length >= 2 ? "compare" : selectedCandidates.length === 1 ? "candidate" : "general",
          locale,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setMessages(prev => [...prev, { role: "assistant", content: data.response, timestamp: new Date() }]);
    } catch {
      toast.error(t("common.error"));
      setMessages(prev => prev.slice(0, -1));
      setInput(msg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredCandidates = candidates.filter(c =>
    c.full_name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(candidateSearch.toLowerCase())
  );

  const labels = {
    he: {
      title: "עוזר AI חכם",
      subtitle: "שאל אותי כל שאלה על המועמדים, המשרות והתהליכים",
      placeholder: "שאל את העוזר... (Enter לשליחה)",
      thinking: "חושב...",
      general: "מצב כללי",
      candidate_mode: "ניתוח מועמד",
      compare_mode: "השוואת מועמדים",
      select_candidates: "בחר מועמדים",
      search_candidates: "חפש מועמד...",
      selected: "נבחרו",
      clear: "נקה",
      summary: "סיכום מועמדים",
      jobs_analysis: "ניתוח משרות",
      weekly_report: "דו״ח למנכ״ל",
      interviews: "ראיונות קרובים",
      deep_dive: "ספר לי הכל על המועמד/ים שבחרתי",
      compare_prompt: "השווה בין המועמדים שבחרתי - מי הכי מתאים ולמה?",
      recommend: "מי המועמד הטוב ביותר ולמה? תן המלצה מפורטת למנכ״ל",
      gaps: "מה חסר לנו? אילו מקצועות ותפקידים אנחנו חסרים?",
    },
    en: {
      title: "Smart AI Assistant",
      subtitle: "Ask me anything about candidates, jobs and processes",
      placeholder: "Ask the assistant... (Enter to send)",
      thinking: "Thinking...",
      general: "General Mode",
      candidate_mode: "Candidate Analysis",
      compare_mode: "Compare Candidates",
      select_candidates: "Select Candidates",
      search_candidates: "Search candidate...",
      selected: "selected",
      clear: "Clear",
      summary: "Candidates Summary",
      jobs_analysis: "Jobs Analysis",
      weekly_report: "CEO Report",
      interviews: "Upcoming Interviews",
      deep_dive: "Tell me everything about the selected candidate(s)",
      compare_prompt: "Compare the selected candidates - who is the best fit and why?",
      recommend: "Who is the best candidate and why? Give a detailed CEO recommendation",
      gaps: "What are we missing? Which professions and roles do we lack?",
    },
    tl: {
      title: "Matalinong AI Assistant",
      subtitle: "Tanungin mo ako tungkol sa mga kandidato, trabaho at proseso",
      placeholder: "Tanungin ang assistant... (Enter para ipadala)",
      thinking: "Nag-iisip...",
      general: "General Mode",
      candidate_mode: "Pagsusuri ng Kandidato",
      compare_mode: "Ihambing ang mga Kandidato",
      select_candidates: "Pumili ng Kandidato",
      search_candidates: "Hanapin ang kandidato...",
      selected: "napili",
      clear: "I-clear",
      summary: "Buod ng Kandidato",
      jobs_analysis: "Pagsusuri ng Trabaho",
      weekly_report: "Ulat sa CEO",
      interviews: "Mga Paparating na Panayam",
      deep_dive: "Sabihin mo sa akin ang lahat tungkol sa napiling kandidato",
      compare_prompt: "Ihambing ang mga napiling kandidato - sino ang pinakamahusay at bakit?",
      recommend: "Sino ang pinakamahusay na kandidato at bakit? Magbigay ng detalyadong rekomendasyon para sa CEO",
      gaps: "Ano ang kulang sa atin? Aling mga propesyon at tungkulin ang wala tayo?",
    },
  };
  const l = labels[locale] || labels.he;

  const quickActions = [
    { icon: Users, label: l.summary, prompt: l.summary },
    { icon: Briefcase, label: l.jobs_analysis, prompt: l.jobs_analysis },
    { icon: TrendingUp, label: l.weekly_report, prompt: l.weekly_report },
    { icon: Calendar, label: l.interviews, prompt: l.interviews },
  ];

  const contextActions = selectedCandidates.length > 0 ? [
    { icon: UserSearch, label: l.deep_dive, prompt: l.deep_dive },
    ...(selectedCandidates.length >= 2 ? [{ icon: GitCompare, label: l.compare_prompt, prompt: l.compare_prompt }] : []),
    { icon: FileText, label: l.recommend, prompt: l.recommend },
  ] : [];

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--gray-50)' }}>
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b px-6 py-4" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, var(--blue), #8B5CF6)' }}>
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--navy)' }}>{l.title}</h1>
              <p className="text-xs" style={{ color: 'var(--gray-400)' }}>{l.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Candidate selector toggle */}
            <Button
              variant={showCandidateSelector ? "default" : "outline"}
              size="sm"
              className="rounded-lg text-xs gap-1.5"
              onClick={() => setShowCandidateSelector(!showCandidateSelector)}
              style={showCandidateSelector ? { background: 'var(--blue)' } : {}}
            >
              <Users className="h-3.5 w-3.5" />
              {l.select_candidates}
              {selectedCandidates.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-blue-600">{selectedCandidates.length}</span>
              )}
            </Button>
            {selectedCandidates.length > 0 && (
              <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => setSelectedCandidates([])}>
                <X className="h-3.5 w-3.5" /> {l.clear}
              </Button>
            )}
          </div>
        </div>

        {/* Candidate selector panel */}
        {showCandidateSelector && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }}>
            <input
              type="text"
              value={candidateSearch}
              onChange={e => setCandidateSearch(e.target.value)}
              placeholder={l.search_candidates}
              className="w-full px-3 py-2 rounded-lg text-sm mb-2"
              style={{ border: '1px solid var(--gray-200)', background: 'white' }}
            />
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredCandidates.slice(0, 30).map(c => {
                const isSelected = selectedCandidates.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCandidate(c.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: isSelected ? 'var(--blue)' : 'white',
                      color: isSelected ? '#fff' : 'var(--gray-600)',
                      border: `1px solid ${isSelected ? 'var(--blue)' : 'var(--gray-200)'}`,
                    }}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {c.full_name}
                  </button>
                );
              })}
            </div>
            {selectedCandidates.length > 0 && (
              <p className="text-xs mt-2 font-medium" style={{ color: 'var(--blue)' }}>
                {selectedCandidates.length} {l.selected}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl mb-5" style={{ background: 'linear-gradient(135deg, var(--blue), #8B5CF6)' }}>
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--navy)' }}>{l.title}</h2>
            <p className="text-sm text-center max-w-md mb-6" style={{ color: 'var(--gray-400)' }}>{l.subtitle}</p>

            {/* Context-specific actions */}
            {contextActions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-xl mb-4">
                {contextActions.map((action, i) => (
                  <button key={i} onClick={() => sendMessage(action.prompt)}
                    className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-medium transition-all hover:shadow-md border"
                    style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
                  >
                    <action.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{action.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* General quick actions */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {quickActions.map((action, i) => (
                <button key={i} onClick={() => sendMessage(action.prompt)}
                  className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl text-sm font-medium transition-all hover:shadow-md text-right"
                  style={{ boxShadow: 'var(--shadow-sm)', color: 'var(--navy)' }}
                >
                  <action.icon className="h-5 w-5 shrink-0" style={{ color: 'var(--blue)' }} />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: msg.role === "user" ? 'var(--blue)' : 'linear-gradient(135deg, var(--blue), #8B5CF6)' }}>
              {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "text-white" : ""}`}
              style={{ background: msg.role === "user" ? 'var(--blue)' : 'white', color: msg.role === "user" ? 'white' : 'var(--gray-800)', boxShadow: msg.role === "assistant" ? 'var(--shadow-sm)' : 'none', whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--blue), #8B5CF6)' }}>
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--blue)' }} />
              <span className="text-sm" style={{ color: 'var(--gray-400)' }}>{l.thinking}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white dark:bg-slate-800 border-t px-6 py-3" style={{ borderColor: 'var(--gray-200)' }}>
        {selectedCandidates.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: 'var(--gray-400)' }}>
              {selectedCandidates.length >= 2 ? "🔄 " : "🔍 "}
              {selectedCandidates.length >= 2 ? l.compare_mode : l.candidate_mode}:
            </span>
            {selectedCandidates.map(id => {
              const c = candidates.find(x => x.id === id);
              return c ? <span key={id} className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>{c.full_name}</span> : null;
            })}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={l.placeholder}
            className="flex-1 resize-none rounded-xl min-h-[44px] max-h-[120px] text-sm"
            style={{ borderColor: 'var(--gray-200)' }}
            rows={1}
            disabled={loading}
          />
          <Button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="h-11 w-11 rounded-xl shrink-0 p-0"
            style={{ background: input.trim() ? 'var(--blue)' : 'var(--gray-200)' }}>
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
