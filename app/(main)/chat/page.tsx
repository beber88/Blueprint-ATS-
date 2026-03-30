"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useUser } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Users, Plus } from "lucide-react";

interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  participants: { id: string; full_name: string; email: string }[];
  lastMessage: { content: string; sender_id: string; created_at: string } | null;
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  shared_data: Record<string, unknown>;
  created_at: string;
  sender?: { id: string; full_name: string; email: string };
}

export default function ChatPage() {
  const { locale } = useI18n();
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const labels = {
    he: { title: "צ'אט צוות", new_chat: "צ'אט חדש", type_msg: "הקלד הודעה...", send: "שלח", no_conv: "אין שיחות עדיין", start: "התחל שיחה", search: "חיפוש...", select: "בחר שיחה" },
    en: { title: "Team Chat", new_chat: "New Chat", type_msg: "Type a message...", send: "Send", no_conv: "No conversations yet", start: "Start a conversation", search: "Search...", select: "Select a conversation" },
    tl: { title: "Team Chat", new_chat: "Bagong Chat", type_msg: "Mag-type ng mensahe...", send: "Ipadala", no_conv: "Wala pang usapan", start: "Magsimula ng usapan", search: "Maghanap...", select: "Pumili ng usapan" },
  };
  const l = labels[locale] || labels.he;

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(data => {
      setTeamMembers(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv);
      const interval = setInterval(() => loadMessages(activeConv), 5000); // Poll every 5s
      return () => clearInterval(interval);
    }
  }, [activeConv, loadMessages]);

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || sending) return;
    setSending(true);
    const msg = input;
    setInput("");
    try {
      await fetch(`/api/chat/conversations/${activeConv}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msg, message_type: "text" }),
      });
      await loadMessages(activeConv);
      loadConversations();
    } catch { /* ignore */ }
    finally { setSending(false); inputRef.current?.focus(); }
  };

  const startChat = async (memberId: string) => {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "direct", participant_ids: [memberId] }),
      });
      const data = await res.json();
      if (data.conversation) {
        setActiveConv(data.conversation.id);
        setShowNewChat(false);
        loadConversations();
      }
    } catch { /* ignore */ }
  };

  const getConvName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    const other = conv.participants.find(p => p.id !== user?.id);
    return other?.full_name || other?.email || "Chat";
  };

  const getInitial = (name: string) => (name || "?")[0].toUpperCase();

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return locale === "he" ? "עכשיו" : "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const activeConvData = conversations.find(c => c.id === activeConv);

  return (
    <div className="flex h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Left panel - conversations list */}
      <div className="flex flex-col" style={{ width: 320, borderRight: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{l.title}</h2>
            <Button size="sm" className="rounded-lg text-xs h-8" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }} onClick={() => setShowNewChat(!showNewChat)}>
              <Plus className="h-3 w-3 mr-1" /> {l.new_chat}
            </Button>
          </div>
        </div>

        {/* New chat - team member picker */}
        {showNewChat && (
          <div className="p-3 space-y-1" style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-secondary)" }}>
            {teamMembers.filter(m => m.id !== user?.id).map(member => (
              <button key={member.id} onClick={() => startChat(member.id)} className="flex items-center gap-3 w-full p-2 rounded-lg text-sm hover:opacity-80" style={{ color: "var(--text-primary)" }}>
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}>
                  {getInitial(member.full_name)}
                </div>
                <div className="text-right">
                  <p className="font-medium">{member.full_name}</p>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{member.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && !loading ? (
            <div className="p-8 text-center">
              <MessageCircle className="h-10 w-10 mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{l.no_conv}</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => { setActiveConv(conv.id); setShowNewChat(false); }}
                className="flex items-center gap-3 w-full p-3 transition-colors"
                style={{
                  borderBottom: "0.5px solid var(--border-light)",
                  background: activeConv === conv.id ? "var(--bg-secondary)" : "transparent",
                }}
              >
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: conv.type === "group" ? "var(--bg-tertiary)" : "var(--brand-gold)", color: conv.type === "group" ? "var(--text-secondary)" : "#1A1A1A" }}>
                  {conv.type === "group" ? <Users className="h-4 w-4" /> : getInitial(getConvName(conv))}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{getConvName(conv)}</p>
                    {conv.lastMessage && (
                      <span className="text-[10px] shrink-0" style={{ color: "var(--text-tertiary)" }}>{timeAgo(conv.lastMessage.created_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
                      {conv.lastMessage?.content || ""}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}>
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel - messages */}
      <div className="flex-1 flex flex-col">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{l.select}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}>
                {activeConvData ? getInitial(getConvName(activeConvData)) : "?"}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{activeConvData ? getConvName(activeConvData) : ""}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map(msg => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[70%]">
                      {!isOwn && msg.sender && (
                        <p className="text-[10px] font-medium mb-0.5 px-1" style={{ color: "var(--text-tertiary)" }}>{msg.sender.full_name}</p>
                      )}
                      <div className="px-3.5 py-2 rounded-xl text-sm" style={{
                        background: isOwn ? "rgba(201,168,76,0.12)" : "var(--bg-secondary)",
                        color: "var(--text-primary)",
                        borderRadius: isOwn ? "12px 12px 0 12px" : "12px 12px 12px 0",
                      }}>
                        <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                      </div>
                      <p className={`text-[10px] mt-0.5 px-1 ${isOwn ? "text-right" : ""}`} style={{ color: "var(--text-tertiary)" }}>
                        {new Date(msg.created_at).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 flex items-end gap-2" style={{ borderTop: "1px solid var(--border-primary)", background: "var(--bg-card)" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={l.type_msg}
                className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm max-h-24"
                style={{ border: "1px solid var(--border-primary)", background: "var(--bg-input)", color: "var(--text-primary)" }}
                rows={1}
              />
              <Button onClick={sendMessage} disabled={!input.trim() || sending} className="h-10 w-10 rounded-xl shrink-0 p-0" style={{ background: input.trim() ? "var(--brand-gold)" : "var(--bg-tertiary)" }}>
                <Send className="h-4 w-4" style={{ color: input.trim() ? "#1A1A1A" : "var(--text-tertiary)" }} />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
