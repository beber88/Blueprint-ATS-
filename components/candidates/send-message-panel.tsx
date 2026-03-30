"use client";

import { useEffect, useState } from "react";
import { Mail, MessageSquare, Send, Clock, CheckCircle, XCircle } from "lucide-react";

interface Template {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  variables?: string[];
}

interface Message {
  id: string;
  channel: string;
  subject?: string;
  body: string;
  status: string;
  sent_at?: string;
  created_at: string;
}

interface SendMessagePanelProps {
  candidate: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  lang: string;
  onMessageSent?: () => void;
}

export function SendMessagePanel({ candidate, lang, onMessageSent }: SendMessagePanelProps) {
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Fetch templates
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : data.templates || []))
      .catch(() => {});
  }, []);

  // Fetch message history
  const fetchMessages = () => {
    setLoadingMessages(true);
    fetch(`/api/candidates/${candidate.id}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  };

  useEffect(() => {
    fetchMessages();
  }, [candidate.id]);

  // Auto-fill template
  useEffect(() => {
    if (!selectedTemplateId) return;
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;

    const fill = (text: string) =>
      text.replace(/\{\{candidate_name\}\}/gi, candidate.full_name);

    setSubject(tpl.subject ? fill(tpl.subject) : "");
    setBody(fill(tpl.body));
    if (tpl.channel === "email" || tpl.channel === "whatsapp") {
      setChannel(tpl.channel as "email" | "whatsapp");
    }
  }, [selectedTemplateId, templates, candidate.full_name]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: candidate.id,
          channel,
          subject: channel === "email" ? subject : undefined,
          body,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send");
      }
      setFeedback({ type: "success", text: lang === "he" ? "ההודעה נשלחה!" : lang === "tl" ? "Naipadala ang mensahe!" : "Message sent!" });
      setSubject("");
      setBody("");
      setSelectedTemplateId("");
      fetchMessages();
      onMessageSent?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send";
      setFeedback({ type: "error", text: message });
    } finally {
      setSending(false);
    }
  };

  const labels = {
    email: lang === "he" ? "אימייל" : lang === "tl" ? "Email" : "Email",
    whatsapp: "WhatsApp",
    template: lang === "he" ? "תבנית" : lang === "tl" ? "Template" : "Template",
    selectTemplate: lang === "he" ? "בחרו תבנית" : lang === "tl" ? "Pumili ng Template" : "Select Template",
    subject: lang === "he" ? "נושא" : lang === "tl" ? "Paksa" : "Subject",
    body: lang === "he" ? "הודעה" : lang === "tl" ? "Nilalaman" : "Message",
    send: lang === "he" ? "שלח" : lang === "tl" ? "Ipadala" : "Send",
    sending: lang === "he" ? "שולח..." : lang === "tl" ? "Ipinapadala..." : "Sending...",
    history: lang === "he" ? "היסטוריית הודעות" : lang === "tl" ? "Kasaysayan ng Mensahe" : "Message History",
    noMessages: lang === "he" ? "אין הודעות עדיין" : lang === "tl" ? "Wala pang mensahe" : "No messages yet",
    channel: lang === "he" ? "ערוץ" : lang === "tl" ? "Channel" : "Channel",
  };

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}
      >
        {/* Channel Toggle */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            {labels.channel}:
          </span>
          <button
            onClick={() => setChannel("email")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: channel === "email" ? "var(--brand-gold)" : "var(--bg-tertiary)",
              color: channel === "email" ? "#fff" : "var(--text-secondary)",
              border: "1px solid " + (channel === "email" ? "var(--brand-gold)" : "var(--border-primary)"),
            }}
          >
            <Mail className="h-4 w-4" />
            {labels.email}
          </button>
          <button
            onClick={() => setChannel("whatsapp")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: channel === "whatsapp" ? "#25D366" : "var(--bg-tertiary)",
              color: channel === "whatsapp" ? "#fff" : "var(--text-secondary)",
              border: "1px solid " + (channel === "whatsapp" ? "#25D366" : "var(--border-primary)"),
            }}
          >
            <MessageSquare className="h-4 w-4" />
            {labels.whatsapp}
          </button>
        </div>

        {/* Template Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {labels.template}
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">{labels.selectTemplate}</option>
            {templates
              .filter((t) => !t.channel || t.channel === channel)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>

        {/* Subject (email only) */}
        {channel === "email" && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {labels.subject}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        )}

        {/* Body */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {labels.body}
          </label>
          <textarea
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm resize-y"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-sm"
            style={{
              background: feedback.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: feedback.type === "success" ? "#16a34a" : "#dc2626",
            }}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {feedback.text}
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || !body.trim()}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{
            background: "var(--brand-gold)",
            color: "#fff",
          }}
        >
          <Send className="h-4 w-4" />
          {sending ? labels.sending : labels.send}
        </button>
      </div>

      {/* Message History */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}
      >
        <h3 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          {labels.history}
        </h3>
        {loadingMessages ? (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>...</p>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{labels.noMessages}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-lg p-4"
                style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {msg.channel === "email" ? (
                      <Mail className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    ) : (
                      <MessageSquare className="h-4 w-4" style={{ color: "#25D366" }} />
                    )}
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                      {msg.channel === "email" ? labels.email : labels.whatsapp}
                    </span>
                    {msg.subject && (
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {msg.subject}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: msg.status === "sent" ? "rgba(34,197,94,0.1)" : "var(--bg-tertiary)",
                        color: msg.status === "sent" ? "#16a34a" : "var(--text-tertiary)",
                      }}
                    >
                      {msg.status}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      <Clock className="h-3 w-3" />
                      {new Date(msg.sent_at || msg.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-sm line-clamp-2" style={{ color: "var(--text-tertiary)" }}>
                  {msg.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
