"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navigation = [
  { name: "דשבורד", href: "/dashboard", icon: LayoutDashboard },
  { name: "מועמדים", href: "/candidates", icon: Users },
  { name: "משרות", href: "/jobs", icon: Briefcase },
  { name: "ראיונות", href: "/interviews", icon: Calendar },
  { name: "הודעות", href: "/messages", icon: MessageSquare },
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
    <aside className="flex h-full flex-col" style={{ width: '260px', minWidth: '260px', backgroundColor: '#0F172A' }}>
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: '#3B82F6' }}>
            <span className="text-sm font-bold text-white">B</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Blueprint ATS</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 pt-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
              style={isActive ? { backgroundColor: '#3B82F6' } : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200"
        >
          <LogOut className="h-5 w-5" />
          התנתק
        </button>
      </div>
    </aside>
  );
}
