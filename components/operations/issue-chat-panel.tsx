"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Loader2, Send, X, User } from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  message_type: string;
  created_at: string;
  sender?: { id: string; full_name: string; email: string; avatar_url: string | null } | null;
}

interface IssueChatPanelProps {
  itemId: string;
  itemIssue: string;
  onClose: () => void;
}

export function IssueChatPanel({ itemId, itemIssue, onClose }: IssueChatPanelProps) {
  const { locale } = useI18n();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isRtl = locale === "he";
  const title = isRtl ? "\u05D3\u05D9\u05D5\u05DF \u05D1\u05E1\u05D5\u05D2\u05D9\u05D4" : "Discuss Issue";
  const placeholder = isRtl ? "\u05DB\u05EA\u05D5\u05D1 \u05D4\u05D5\u05D3\u05E2\u05D4..." : "Type a message...";
  const noMessages = isRtl ? "\u05D0\u05D9\u05DF \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF" : "No messages yet";

  // Scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize conversation
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`/api/chat/conversations/by-context?entity_type=item&entity_id=${itemId}`);
        if (!res.ok) throw new Error("Failed to get conversation");
        const data = await res.json();
        setConversationId(data.conversation.id);
      } catch (err) {
        console.error("Failed to init chat:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [itemId]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      // silent
    }
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Poll every 5 seconds
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [conversationId, loadMessages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !conversationId || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, message_type: "text" }),
      });
      if (!res.ok) throw new Error("Failed to send");
      await loadMessages();
    } catch (err) {
      console.error("Send error:", err);
      setInput(text); // restore input on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString(isRtl ? "he-IL" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 998,
        }}
      />
      {/* Panel */}
      <div
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          position: "fixed",
          top: 0,
          [isRtl ? "left" : "right"]: 0,
          width: 360,
          height: "100vh",
          background: "var(--bg-card)",
          borderInlineStart: "1px solid var(--border-light)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-light)",
            minHeight: 52,
          }}
        >
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#C9A84C" }}>
              {title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {itemIssue}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: 4,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
          }}
        >
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <Loader2 size={22} className="animate-spin" style={{ color: "#C9A84C" }} />
            </div>
          ) : messages.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                color: "var(--text-secondary)",
                fontSize: 13,
              }}
            >
              {noMessages}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: "#1A56A8",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {msg.sender?.full_name ? (
                    msg.sender.full_name.charAt(0).toUpperCase()
                  ) : (
                    <User size={14} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                      {msg.sender?.full_name || msg.sender?.email || "User"}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--text-primary)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: "8px 12px 12px",
            borderTop: "1px solid var(--border-light)",
            display: "flex",
            gap: 8,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={placeholder}
            rows={2}
            dir={isRtl ? "rtl" : "ltr"}
            style={{
              flex: 1,
              padding: 8,
              border: "1px solid var(--border-light)",
              borderRadius: 6,
              background: "var(--bg-input, var(--bg-card))",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: 13,
              resize: "none",
              outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            style={{
              padding: "0 12px",
              background: "#C9A84C",
              color: "#1A1A1A",
              border: "none",
              borderRadius: 6,
              cursor: sending || !input.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: sending || !input.trim() ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>

        <style>{`
          @keyframes slideIn {
            from { transform: translateX(${isRtl ? "-100%" : "100%"}); }
            to { transform: translateX(0); }
          }
        `}</style>
      </div>
    </>
  );
}
