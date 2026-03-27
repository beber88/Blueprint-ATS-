"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Briefcase, Calendar, MessageSquare, Settings, LogOut, FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navigation = [
  { name: "דשבורד", href: "/dashboard", icon: LayoutDashboard },
  { name: "מועמדים", href: "/candidates", icon: Users },
  { name: "משרות", href: "/jobs", icon: Briefcase },
  { name: "ראיונות", href: "/interviews", icon: Calendar },
  { name: "הודעות", href: "/messages", icon: MessageSquare },
  { name: "תבניות", href: "/templates", icon: FileText },
  { name: "הגדרות", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="flex h-full flex-col" style={{ width: '240px', minWidth: '240px', background: 'var(--navy)' }}>
      <div className="flex items-center gap-3 px-5 h-16">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
          <span className="text-sm font-bold text-white">B</span>
        </div>
        <span className="text-base font-bold text-white tracking-tight">Blueprint ATS</span>
      </div>

      <nav className="flex-1 px-3 pt-4 space-y-0.5">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150"
              style={isActive ? {
                background: 'rgba(59,130,246,0.15)',
                color: '#fff',
                borderRight: '3px solid var(--blue)',
              } : {
                color: 'rgba(255,255,255,0.6)',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 mt-3 text-sm font-medium rounded-lg transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        >
          <LogOut className="h-5 w-5" />
          התנתק
        </button>
      </div>
    </aside>
  );
}
