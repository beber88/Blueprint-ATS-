"use client";

import { Sidebar } from "@/components/shared/sidebar";
import { AIChatBubble } from "@/components/shared/ai-chat-bubble";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 right-3 z-50 md:hidden h-10 w-10 rounded-xl flex items-center justify-center"
        style={{ background: "var(--brand-gold)", color: "#1A1A1A" }}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on desktop */}
      <div className={`
        fixed inset-y-0 right-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}>
        <div className="relative h-full">
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-3 left-3 z-10 md:hidden h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <X className="h-5 w-5" />
          </button>
          <Sidebar />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto w-full" style={{ background: "var(--bg-primary)" }}>
        {/* Spacer for mobile menu button */}
        <div className="h-14 md:hidden" />
        {children}
      </main>

      {/* Floating AI Chat Bubble */}
      <AIChatBubble />
    </div>
  );
}
