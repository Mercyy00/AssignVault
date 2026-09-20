import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { listReportedTemplates } from "@/lib/admin/reportsDownloads";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportActions } from "@/components/admin/ReportActions";
import { Flag, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createServerClient();
  if (!supabase) {
    return (
      <EmptyState title="Database not configured" description="Supabase env vars are missing." />
    );
  }

  const reports = await listReportedTemplates(supabase);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reported templates"
        description="Templates downloaders have flagged. Most-reported first."
        backHref="/admin"
        backLabel="Dashboard"
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8" />}
          title="No reports"
          description="No template has been reported. All clear."
        />
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500 shrink-0">
                  <Flag className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/review/${r.id}`}
                    className="font-medium text-sm hover:underline truncate block"
                  >
                    {r.subjectName} — Assignment {r.assignmentNumber}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    Batch {r.batchName} · {r.status}
                  </div>
                </div>
                <Badge variant="danger" className="shrink-0">
                  {r.reportCount} report{r.reportCount === 1 ? "" : "s"}
                </Badge>
                <ReportActions templateId={r.id} status={r.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
