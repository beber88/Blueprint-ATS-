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
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navigation = [
  { name: "לוח בקרה", href: "/dashboard", icon: LayoutDashboard },
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
    <div className="flex h-full w-64 flex-col bg-navy-900 text-white">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-navy-700">
        <FileText className="h-8 w-8 text-electric-400" />
        <div>
          <h1 className="text-lg font-bold text-white">Blueprint</h1>
          <p className="text-xs text-navy-300">ATS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-electric-500 text-white"
                  : "text-navy-200 hover:bg-navy-800 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-navy-700 p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-300 hover:bg-navy-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          התנתק
        </button>
      </div>
    </div>
  );
}
