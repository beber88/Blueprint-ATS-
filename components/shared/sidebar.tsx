"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Briefcase, Calendar, MessageSquare, MessageCircle, Settings, LogOut, FileText, Bot, FolderOpen,
  Sun, Moon, UserCog, BookOpen, Globe, FileQuestion, FileBarChart,
  IdCard, Building2, Cloud,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useI18n, Locale } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme/context";
import { useUser } from "@/lib/auth/context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LucideIcon } from "lucide-react";

const navGroups: { labelKey: string; items: { key: string; href: string; icon: LucideIcon; adminOnly?: boolean }[] }[] = [
  {
    labelKey: "nav_group.main",
    items: [
      { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "nav.candidates", href: "/candidates", icon: Users },
      { key: "nav.jobs", href: "/jobs", icon: Briefcase },
      { key: "nav.interviews", href: "/interviews", icon: Calendar },
    ],
  },
  {
    labelKey: "nav_group.hr",
    items: [
      { key: "nav.employees", href: "/employees", icon: IdCard },
      { key: "nav.departments", href: "/departments", icon: Building2 },
      { key: "nav.drive_sync", href: "/drive-sync", icon: Cloud },
    ],
  },
  {
    labelKey: "nav_group.communication",
    items: [
      { key: "nav.chat", href: "/chat", icon: MessageCircle },
      { key: "nav.messages", href: "/messages", icon: MessageSquare },
      { key: "nav.templates", href: "/templates", icon: FileText },
    ],
  },
  {
    labelKey: "nav_group.tools",
    items: [
      { key: "nav.ai_agent", href: "/ai-agent", icon: Bot },
      { key: "nav.categories", href: "/categories", icon: FolderOpen },
      { key: "nav.guide", href: "/guide", icon: BookOpen },
    ],
  },
  {
    labelKey: "nav_group.management",
    items: [
      { key: "nav.unmatched_files", href: "/files", icon: FileQuestion },
      { key: "nav.reports", href: "/reports", icon: FileBarChart, adminOnly: true },
      { key: "nav.settings", href: "/settings", icon: Settings },
      { key: "nav.job_boards", href: "/settings/job-boards", icon: Globe },
      { key: "nav.users", href: "/users", icon: UserCog, adminOnly: true },
    ],
  },
];

const languages: { code: Locale; label: string }[] = [
  { code: "he", label: "עב" },
  { code: "en", label: "EN" },
  { code: "tl", label: "TL" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, isAdmin } = useUser();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#C9A84C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#1A1A1A', fontSize: 16, fontWeight: 700 }}>B</span>
          </div>
          <span style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Blueprint
          </span>
        </div>
        {/* Gold separator */}
        <div style={{ height: 1, background: 'rgba(201,168,76,0.25)', marginTop: 16 }} />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 12px 0 12px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div style={{ height: 1, background: 'var(--sidebar-border, rgba(255,255,255,0.08))', margin: '8px 4px' }} />}
              <div style={{ padding: '4px 12px 4px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8A8A8A', opacity: 0.5 }}>
                {t(group.labelKey)}
              </div>
              {group.items.filter(item => !item.adminOnly || isAdmin).map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: isActive ? 500 : 400,
                      textDecoration: 'none',
                      transition: 'background 150ms, color 150ms',
                      background: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
                      color: isActive ? '#C9A84C' : '#8A8A8A',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(201,168,76,0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <item.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom section */}
      <div style={{ padding: '0 12px 16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Language switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 4px 8px 4px' }}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLocale(lang.code)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms',
                background: locale === lang.code ? '#C9A84C' : 'transparent',
                color: locale === lang.code ? '#1A1A1A' : '#8A8A8A',
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            width: '100%',
            fontSize: 13,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: '#8A8A8A',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#C9A84C'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#8A8A8A'; }}
        >
          {theme === "dark" ? (
            <Sun style={{ width: 16, height: 16, color: '#C9A84C' }} />
          ) : (
            <Moon style={{ width: 16, height: 16 }} />
          )}
          <span>{theme === "dark" ? t("common.light_mode") : t("common.dark_mode")}</span>
        </button>

        {/* User info */}
        {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              marginTop: 4,
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Avatar className="h-8 w-8">
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback
                style={{
                  background: 'rgba(201,168,76,0.15)',
                  color: '#C9A84C',
                  fontSize: 12,
                }}
              >
                {(user.full_name || user.email)?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#FFFFFF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  margin: 0,
                }}
              >
                {user.full_name || user.email}
              </p>
              {user.role === "admin" && (
                <p style={{ fontSize: 11, color: '#C9A84C', margin: 0 }}>Admin</p>
              )}
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 8,
            width: '100%',
            fontSize: 14,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: '#8A8A8A',
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(201,168,76,0.08)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#8A8A8A';
          }}
        >
          <LogOut style={{ width: 18, height: 18 }} />
          {t("common.logout")}
        </button>
      </div>
    </aside>
  );
}
