import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/admin/queries";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ClipboardCheck,
  AlertTriangle,
  Flag,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  LayoutGrid,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface StatCard {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  tone: "indigo" | "amber" | "rose" | "emerald" | "slate";
}

const TONE: Record<StatCard["tone"], string> = {
  indigo: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50",
  amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50",
  rose: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50",
  emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50",
  slate: "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/60",
};

export default async function AdminDashboard() {
  const supabase = createServerClient();
  if (!supabase) {
    return (
      <div className="py-10">
        <EmptyState
          icon={<AlertTriangle className="w-8 h-8" />}
          title="Database not configured"
          description="Supabase environment variables are missing. Set them and reload."
        />
      </div>
    );
  }

  const stats = await getDashboardStats(supabase);

  const cards: StatCard[] = [
    {
      label: "Pending templates",
      value: stats.pendingTemplates,
      icon: ClipboardCheck,
      href: "/admin/review",
      tone: "indigo",
    },
    {
      label: "Needs review",
      value: stats.needsReview,
      icon: AlertTriangle,
      href: "/admin/review",
      tone: "amber",
    },
    {
      label: "Reported",
      value: stats.reportedTemplates,
      icon: Flag,
      href: "/admin/reports",
      tone: "rose",
    },
    { label: "Uploads this week", value: stats.uploadsThisWeek, icon: UploadCloud, tone: "slate" },
    {
      label: "Downloads this week",
      value: stats.downloadsThisWeek,
      icon: DownloadCloud,
      href: "/admin/downloads",
      tone: "emerald",
    },
  ];

  const totalGaps = stats.gaps.reduce((n, g) => n + g.missing.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Queue health and coverage at a glance."
        backHref=""
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const inner = (
            <Card hoverable={!!c.href} className="h-full">
              <CardContent className="py-4 flex flex-col gap-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${TONE[c.tone]}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold tabular-nums">{c.value}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                  {c.label}
                </div>
              </CardContent>
            </Card>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={c.label}>{inner}</div>
          );
        })}
      </div>

      {/* Coverage gaps */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold">Coverage gaps</h2>
            <span className="text-xs text-zinc-400">
              assignments with no approved template
            </span>
          </div>

          {totalGaps === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Every assignment has at least one approved template.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.gaps
                .filter((g) => g.missing.length > 0)
                .map((g) => (
                  <div key={g.subjectSlug} className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                    <span className="font-medium text-sm min-w-[180px]">{g.subjectName}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {g.missing.map((n) => (
                        <span
                          key={n}
                          className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                          title={`Assignment ${n} has no approved template`}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
