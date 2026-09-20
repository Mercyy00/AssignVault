"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardCheck,
  Flag,
  BookOpen,
  CalendarDays,
  ScrollText,
  LogOut,
} from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/review", label: "Review", icon: ClipboardCheck },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/catalog", label: "Catalog", icon: BookOpen },
  { href: "/admin/dates", label: "Dates", icon: CalendarDays },
  { href: "/admin/downloads", label: "Downloads", icon: ScrollText },
];

export function AdminNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 mb-6">
      <div className="flex items-center gap-1 overflow-x-auto pb-px">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                active
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-3 pl-4">
          {email && (
            <span className="text-xs text-zinc-400 hidden sm:inline truncate max-w-[160px]">
              {email}
            </span>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
