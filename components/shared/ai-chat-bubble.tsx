"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, X, Loader2, Minus } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { usePathname } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIChatBubble() {
  const { locale } = useI18n();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Don't show on the full AI agent page
  if (pathname === "/ai-agent" || pathname === "/ai-search") return null;

  const labels = {
    he: { placeholder: "שאל שאלה...", title: "עוזר AI", thinking: "חושב..." },
    en: { placeholder: "Ask a question...", title: "AI Assistant", thinking: "Thinking..." },
    tl: { placeholder: "Magtanong...", title: "AI Assistant", thinking: "Nag-iisip..." },
  };
  const l = labels[locale] || labels.he;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isOpen]);
  useEffect(() => { if (isOpen && !isMinimized) inputRef.current?.focus(); }, [isOpen, isMinimized]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    const userMsg: Message = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          conversationHistory: messages.slice(-8),
          mode: "general",
          locale,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: locale === "he" ? "מצטער, אירעה שגיאה. נסה שוב." : "Sorry, an error occurred. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  // Floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-all hover:scale-110"
        style={{
          bottom: 24,
          left: locale === "he" ? 24 : "auto",
          right: locale === "he" ? "auto" : 24,
          width: 56,
          height: 56,
          background: "linear-gradient(135deg, #C9A84C, #8B5CF6)",
        }}
      >
        <Bot className="h-6 w-6 text-white" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {messages.filter(m => m.role === "assistant").length}
          </span>
        )}
      </button>
    );
  }

  // Minimized bar
  if (isMinimized) {
    return (
      <div
        className="fixed z-50 flex items-center gap-2 rounded-full shadow-lg cursor-pointer px-4 py-2"
        style={{
          bottom: 24,
          left: locale === "he" ? 24 : "auto",
          right: locale === "he" ? "auto" : 24,
          background: "linear-gradient(135deg, #C9A84C, #8B5CF6)",
          color: "#fff",
        }}
        onClick={() => setIsMinimized(false)}
      >
        <Bot className="h-4 w-4" />
        <span className="text-xs font-medium">{l.title}</span>
        <span className="text-[10px] opacity-75">({messages.length})</span>
        <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }} className="ml-1">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Full chat window
  return (
    <div
      className="fixed z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{
        bottom: 24,
        left: locale === "he" ? 24 : "auto",
        right: locale === "he" ? "auto" : 24,
        width: 380,
        height: 500,
        maxHeight: "70vh",
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "linear-gradient(135deg, #C9A84C, #8B5CF6)" }}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-white" />
          <span className="text-sm font-bold text-white">{l.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(true)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
            <Minus className="h-4 w-4 text-white" />
          </button>
          <button onClick={() => { setIsOpen(false); }} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: "var(--bg-secondary)" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-10 w-10 mb-2" style={{ color: "var(--brand-gold)" }} />
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {locale === "he" ? "שאל אותי כל שאלה על המועמדים, המשרות והתהליכים" : "Ask me anything about candidates, jobs and processes"}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
              style={{ background: msg.role === "user" ? "var(--brand-gold)" : "linear-gradient(135deg, #C9A84C, #8B5CF6)" }}
            >
              {msg.role === "user" ? <User className="h-3 w-3 text-white" /> : <Bot className="h-3 w-3 text-white" />}
            </div>
            <div
              className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed"
              style={{
                background: msg.role === "user" ? "var(--brand-gold)" : "var(--bg-card)",
                color: msg.role === "user" ? "white" : "var(--text-primary)",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, #C9A84C, #8B5CF6)" }}>
              <Bot className="h-3 w-3 text-white" />
            </div>
            <div className="rounded-xl px-3 py-2 flex items-center gap-1.5" style={{ background: "var(--bg-card)" }}>
              <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--brand-gold)" }} />
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{l.thinking}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderTop: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
          placeholder={l.placeholder}
          disabled={loading}
          className="flex-1 text-xs py-2 px-3 rounded-lg outline-none"
          style={{ border: "1px solid var(--border-primary)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors"
          style={{ background: input.trim() ? "var(--brand-gold)" : "var(--border-primary)" }}
        >
          <Send className="h-3.5 w-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}
