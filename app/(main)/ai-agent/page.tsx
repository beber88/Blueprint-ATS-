"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/context";
import { Bot, Send, User, Sparkles, Users, Briefcase, TrendingUp, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const quickActions = [
  { icon: Users, label_he: "סיכום מועמדים", label_en: "Candidates Summary", label_tl: "Buod ng Kandidato", prompt_he: "תן לי סיכום מלא של כל המועמדים במערכת - כמה יש, מה הסטטוס שלהם, מי הכי מתאים", prompt_en: "Give me a full summary of all candidates - how many, their statuses, who are the top ones", prompt_tl: "Bigyan mo ako ng buong buod ng lahat ng kandidato - ilan sila, ano ang status nila, sino ang pinakamahusay" },
  { icon: Briefcase, label_he: "ניתוח משרות", label_en: "Jobs Analysis", label_tl: "Pagsusuri ng Trabaho", prompt_he: "נתח את המשרות הפתוחות - כמה מועמדים לכל משרה, מה הציון הממוצע, איפה חסרים מועמדים", prompt_en: "Analyze open jobs - candidates per job, average scores, where are we short on candidates", prompt_tl: "Suriin ang mga bukas na trabaho - kandidato bawat trabaho, average score, saan kulang ang kandidato" },
  { icon: TrendingUp, label_he: "דו״ח שבועי", label_en: "Weekly Report", label_tl: "Lingguhang Ulat", prompt_he: "צור דו״ח שבועי: מועמדים חדשים, ראיונות שהתקיימו, אישורים ודחיות, צווארי בקבוק", prompt_en: "Generate weekly report: new candidates, completed interviews, approvals/rejections, bottlenecks", prompt_tl: "Gumawa ng lingguhang ulat: bagong kandidato, natapos na panayam, mga aprubado/tinanggihan, mga bottleneck" },
  { icon: Calendar, label_he: "ראיונות קרובים", label_en: "Upcoming Interviews", label_tl: "Mga Paparating na Panayam", prompt_he: "הצג את כל הראיונות הקרובים ותן המלצות להכנה", prompt_en: "Show upcoming interviews and preparation recommendations", prompt_tl: "Ipakita ang mga paparating na panayam at mga rekomendasyon para sa paghahanda" },
];

export default function AIAgentPage() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      const assistantMessage: Message = { role: "assistant", content: data.response, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      toast.error(t("common.error"));
      // Remove the user message if it failed
      setMessages(prev => prev.slice(0, -1));
      setInput(msg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getQuickLabel = (action: typeof quickActions[0]) => {
    if (locale === "en") return action.label_en;
    if (locale === "tl") return action.label_tl;
    return action.label_he;
  };

  const getQuickPrompt = (action: typeof quickActions[0]) => {
    if (locale === "en") return action.prompt_en;
    if (locale === "tl") return action.prompt_tl;
    return action.prompt_he;
  };

  const titles: Record<string, string> = {
    he: "עוזר AI חכם",
    en: "Smart AI Assistant",
    tl: "Matalinong AI Assistant",
  };

  const subtitles: Record<string, string> = {
    he: "שאל אותי כל שאלה על המועמדים, המשרות והתהליכים במערכת",
    en: "Ask me anything about candidates, jobs, and processes in the system",
    tl: "Tanungin mo ako tungkol sa mga kandidato, trabaho, at proseso sa sistema",
  };

  const placeholders: Record<string, string> = {
    he: "שאל את העוזר... (Enter לשליחה)",
    en: "Ask the assistant... (Enter to send)",
    tl: "Tanungin ang assistant... (Enter para ipadala)",
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--gray-50)' }}>
      {/* Header */}
      <div className="bg-white border-b px-8 py-5" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))' }}>
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--navy)' }}>{titles[locale] || titles.he}</h1>
            <p className="text-sm" style={{ color: 'var(--gray-400)' }}>{subtitles[locale] || subtitles.he}</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl mb-6" style={{ background: 'linear-gradient(135deg, var(--blue-light), var(--purple-light))' }}>
              <Sparkles className="h-10 w-10" style={{ color: 'var(--blue)' }} />
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--navy)' }}>{titles[locale] || titles.he}</h2>
            <p className="text-sm text-center max-w-md mb-8" style={{ color: 'var(--gray-400)' }}>
              {subtitles[locale] || subtitles.he}
            </p>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(getQuickPrompt(action))}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl text-sm font-medium transition-all hover:shadow-md text-right"
                  style={{ boxShadow: 'var(--shadow-sm)', color: 'var(--navy)' }}
                >
                  <action.icon className="h-5 w-5 shrink-0" style={{ color: 'var(--blue)' }} />
                  {getQuickLabel(action)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${msg.role === "user" ? "" : ""}`}
              style={{ background: msg.role === "user" ? 'var(--blue)' : 'linear-gradient(135deg, var(--blue), var(--purple))' }}>
              {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${msg.role === "user" ? "text-white" : ""}`}
              style={{
                background: msg.role === "user" ? 'var(--blue)' : 'white',
                color: msg.role === "user" ? 'white' : 'var(--gray-800)',
                boxShadow: msg.role === "assistant" ? 'var(--shadow-sm)' : 'none',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--blue), var(--purple))' }}>
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white rounded-2xl px-5 py-4 flex items-center gap-2" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--blue)' }} />
              <span className="text-sm" style={{ color: 'var(--gray-400)' }}>
                {locale === "en" ? "Thinking..." : locale === "tl" ? "Nag-iisip..." : "חושב..."}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t px-8 py-4" style={{ borderColor: 'var(--gray-200)' }}>
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholders[locale] || placeholders.he}
            className="flex-1 resize-none rounded-xl min-h-[48px] max-h-[120px]"
            style={{ borderColor: 'var(--gray-200)' }}
            rows={1}
            disabled={loading}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="h-12 w-12 rounded-xl shrink-0 p-0"
            style={{ background: input.trim() ? 'var(--blue)' : 'var(--gray-200)' }}
          >
            <Send className="h-5 w-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
