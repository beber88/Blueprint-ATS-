"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Briefcase, Calendar, MessageSquare, MessageCircle, Settings, LogOut, FileText, Bot, FolderOpen,
  Sun, Moon, UserCog, BookOpen, Globe, FileQuestion, FileBarChart,
  Activity, Inbox, AlertTriangle, Building2, HardHat, ClipboardList, ClipboardCheck, Crown, Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useI18n, Locale } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme/context";
import { useUser } from "@/lib/auth/context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LucideIcon } from "lucide-react";

type NavItem = { key: string; path: string; icon: LucideIcon; adminOnly?: boolean };
type NavGroup = { labelKey: string; items: NavItem[] };
type Module = { key: string; labelKey: string; prefix: string; groups: NavGroup[] };

const modules: Module[] = [
  {
    key: "recruitment",
    labelKey: "hr.modules.recruitment",
    prefix: "/hr/recruitment",
    groups: [
      {
        labelKey: "nav_group.main",
        items: [
          { key: "nav.dashboard", path: "/dashboard", icon: LayoutDashboard },
          { key: "nav.candidates", path: "/candidates", icon: Users },
          { key: "nav.jobs", path: "/jobs", icon: Briefcase },
          { key: "nav.interviews", path: "/interviews", icon: Calendar },
        ],
      },
      {
        labelKey: "nav_group.communication",
        items: [
          { key: "nav.chat", path: "/chat", icon: MessageCircle },
          { key: "nav.messages", path: "/messages", icon: MessageSquare },
          { key: "nav.templates", path: "/templates", icon: FileText },
        ],
      },
      {
        labelKey: "nav_group.tools",
        items: [
          { key: "nav.ai_search", path: "/ai-search", icon: Search },
          { key: "nav.ai_agent", path: "/ai-agent", icon: Bot },
          { key: "nav.categories", path: "/categories", icon: FolderOpen },
          { key: "nav.guide", path: "/guide", icon: BookOpen },
        ],
      },
      {
        labelKey: "nav_group.management",
        items: [
          { key: "nav.unmatched_files", path: "/files", icon: FileQuestion },
          { key: "nav.reports", path: "/reports", icon: FileBarChart, adminOnly: true },
          { key: "nav.settings", path: "/settings", icon: Settings },
          { key: "nav.job_boards", path: "/settings/job-boards", icon: Globe },
          { key: "nav.users", path: "/users", icon: UserCog, adminOnly: true },
        ],
      },
    ],
  },
  {
    key: "operations",
    labelKey: "hr.modules.operations",
    prefix: "/hr/operations",
    groups: [
      {
        labelKey: "nav_group.main",
        items: [
          { key: "operations.nav.dashboard", path: "/dashboard", icon: LayoutDashboard },
          { key: "operations.nav.intake", path: "/intake", icon: ClipboardList },
          { key: "operations.nav.drafts", path: "/drafts", icon: FileText },
          { key: "operations.nav.issues", path: "/issues", icon: Activity },
        ],
      },
      {
        labelKey: "operations.nav_group.tracking",
        items: [
          { key: "operations.nav.hr_issues", path: "/hr-issues", icon: Users },
          { key: "operations.nav.ceo_items", path: "/ceo-items", icon: Crown },
          { key: "operations.nav.missing_info", path: "/missing-info", icon: AlertTriangle },
          { key: "operations.nav.attendance", path: "/attendance", icon: ClipboardCheck },
          { key: "operations.nav.followups", path: "/followups", icon: Calendar },
          { key: "operations.nav.alerts", path: "/alerts", icon: AlertTriangle },
        ],
      },
      {
        labelKey: "operations.nav_group.org",
        items: [
          { key: "operations.nav.projects", path: "/projects", icon: HardHat },
          { key: "operations.nav.departments", path: "/departments", icon: Building2 },
          { key: "operations.nav.employees", path: "/employees", icon: Users, adminOnly: true },
        ],
      },
      {
        labelKey: "operations.nav_group.tools",
        items: [
          { key: "operations.nav.ai_agent", path: "/ai-agent", icon: Bot },
          { key: "operations.nav.archive", path: "/archive", icon: Search },
          { key: "operations.nav.inbox", path: "/inbox", icon: Inbox, adminOnly: true },
        ],
      },
    ],
  },
  {
    key: "contracts",
    labelKey: "hr.modules.contracts",
    prefix: "/hr/contracts",
    groups: [
      {
        labelKey: "nav_group.main",
        items: [
          { key: "contracts.nav.dashboard", path: "/dashboard", icon: LayoutDashboard },
          { key: "contracts.nav.intake", path: "/intake", icon: ClipboardList },
          { key: "contracts.nav.drafts", path: "/drafts", icon: FileText },
          { key: "contracts.nav.contracts", path: "/contracts", icon: FileBarChart },
        ],
      },
      {
        labelKey: "contracts.nav_group.tracking",
        items: [
          { key: "contracts.nav.alerts", path: "/alerts", icon: AlertTriangle },
        ],
      },
    ],
  },
];

const languages: { code: Locale; label: string }[] = [
  { code: "he", label: "עב" },
  { code: "en", label: "EN" },
  { code: "tl", label: "TL" },
];

// Strip the active module prefix so active-state matching works regardless of
// whether the URL is the full /hr/<module>/<page> form or a legacy direct one.
function stripPrefix(p: string, prefix: string): string {
  const stripped = p.replace(new RegExp(`^${prefix}`), "");
  return stripped === "" ? "/" : stripped;
}

function activeModuleFor(pathname: string): string {
  for (const m of modules) {
    if (pathname.startsWith(m.prefix)) return m.key;
  }
  // Fallback heuristics for legacy paths
  if (pathname.startsWith("/contracts")) return "contracts";
  if (pathname.startsWith("/operations")) return "operations";
  return "recruitment";
}

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

  const activeKey = activeModuleFor(pathname);

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
      {/* Logo + System Brand */}
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
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {t("hr.brand")}
            </span>
            <span style={{ color: '#8A8A8A', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
              {t("hr.system")}
            </span>
          </div>
        </div>
        {/* Gold separator */}
        <div style={{ height: 1, background: 'rgba(201,168,76,0.25)', marginTop: 16 }} />
      </div>

      {/* Module switcher */}
      <div style={{ padding: '12px 12px 4px 12px', display: 'flex', gap: 6 }}>
        {modules.map((m) => {
          const isActive = m.key === activeKey;
          const firstPath = m.groups[0]?.items[0]?.path || "/dashboard";
          return (
            <Link
              key={m.key}
              href={`${m.prefix}${firstPath}`}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 6px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                background: isActive ? 'rgba(201,168,76,0.15)' : 'transparent',
                color: isActive ? '#C9A84C' : '#8A8A8A',
                textDecoration: 'none',
                border: isActive ? '1px solid rgba(201,168,76,0.35)' : '1px solid transparent',
              }}
            >
              {t(m.labelKey)}
            </Link>
          );
        })}
      </div>

      {/* Navigation for active module */}
      <nav style={{ flex: 1, padding: '8px 12px 0 12px', overflowY: 'auto' }}>
        {modules.filter((m) => m.key === activeKey).map((module) => {
          const normalized = stripPrefix(pathname, module.prefix);
          return (
            <div key={module.key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px 6px 12px',
                  color: '#C9A84C',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
              >
                <span style={{ width: 3, height: 14, background: '#C9A84C', borderRadius: 2 }} />
                {t(module.labelKey)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {module.groups.map((group, gi) => (
                  <div key={gi}>
                    {gi > 0 && <div style={{ height: 1, background: 'var(--sidebar-border, rgba(255,255,255,0.08))', margin: '8px 4px' }} />}
                    <div style={{ padding: '4px 12px 4px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8A8A8A', opacity: 0.5 }}>
                      {t(group.labelKey)}
                    </div>
                    {group.items.filter(item => !item.adminOnly || isAdmin).map((item) => {
                      const href = `${module.prefix}${item.path}`;
                      const isActive = normalized === item.path || normalized.startsWith(item.path + "/");
                      return (
                        <Link
                          key={item.key}
                          href={href}
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
            </div>
          );
        })}
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
