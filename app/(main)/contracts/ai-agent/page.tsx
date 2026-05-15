"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

interface Msg { role: "user" | "assistant"; content: string; timestamp: Date }

export default function ContractsAgentPage() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setMessages((p) => [...p, { role: "user", content: msg, timestamp: new Date() }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/contracts/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessages((p) => [...p, { role: "assistant", content: data.response, timestamp: new Date() }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const suggestions = [
    t("contracts.agent.suggest.expiring"),
    t("contracts.agent.suggest.flagged"),
    t("contracts.agent.suggest.subcontractors"),
    t("contracts.agent.suggest.briefing"),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 960, margin: "0 auto", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Bot size={22} style={{ color: "#C9A84C" }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t("contracts.agent.title")}</h1>
          <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{t("contracts.agent.subtitle")}</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-secondary)" }}>
            <Sparkles size={28} style={{ color: "#C9A84C" }} />
            <p style={{ marginTop: 12 }}>{t("contracts.agent.ask_anything")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 16, maxWidth: 480, marginInline: "auto" }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  style={{ padding: 10, background: "transparent", border: "1px solid var(--border-primary)", borderRadius: 8, cursor: "pointer", color: "var(--text-primary)", fontSize: 12, textAlign: "start" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: i < messages.length - 1 ? "1px solid var(--border-light)" : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: m.role === "user" ? "#1A56A8" : "#C9A84C", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div style={{ flex: 1, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.55 }}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", color: "var(--text-secondary)" }}>
            <Loader2 size={14} className="animate-spin" />
            {t("contracts.agent.thinking")}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t("contracts.agent.placeholder")}
          rows={2}
          dir={locale === "he" ? "rtl" : "ltr"}
          style={{ flex: 1, padding: 10, border: "1px solid var(--border-primary)", borderRadius: 8, background: "var(--bg-input)", color: "var(--text-primary)", fontFamily: "inherit", fontSize: 14, resize: "none" }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{ padding: "0 16px", background: "#C9A84C", color: "#1A1A1A", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, opacity: loading || !input.trim() ? 0.6 : 1 }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
