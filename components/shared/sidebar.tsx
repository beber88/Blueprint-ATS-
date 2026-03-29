"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Briefcase, Calendar, MessageSquare, Settings, LogOut, FileText, Bot, FolderOpen,
  Sun, Moon, UserCog, BookOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useTheme } from "@/lib/theme/context";
import { useUser } from "@/lib/auth/context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { LucideIcon } from "lucide-react";

const navigation: { key: string; href: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "nav.candidates", href: "/candidates", icon: Users },
  { key: "nav.categories", href: "/categories", icon: FolderOpen },
  { key: "nav.jobs", href: "/jobs", icon: Briefcase },
  { key: "nav.interviews", href: "/interviews", icon: Calendar },
  { key: "nav.messages", href: "/messages", icon: MessageSquare },
  { key: "nav.templates", href: "/templates", icon: FileText },
  { key: "nav.ai_agent", href: "/ai-agent", icon: Bot },
  { key: "nav.guide", href: "/guide", icon: BookOpen },
  { key: "nav.settings", href: "/settings", icon: Settings },
  { key: "nav.users", href: "/users", icon: UserCog, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, isAdmin } = useUser();

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
        {navigation.filter(item => !item.adminOnly || isAdmin).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.key}
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
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="py-3">
          <LanguageSwitcher />
        </div>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-sm"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? (locale === "he" ? "מצב יום" : "Light") : (locale === "he" ? "מצב לילה" : "Dark")}
        </button>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <Avatar className="h-8 w-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="bg-blue-500/20 text-white text-xs">{(user.full_name || user.email)?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.full_name || user.email}</p>
              {user.role === "admin" && <p className="text-[10px] text-blue-400">Admin</p>}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 mt-1 text-sm font-medium rounded-lg transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        >
          <LogOut className="h-5 w-5" />
          {t("common.logout")}
        </button>
      </div>
    </aside>
  );
}
