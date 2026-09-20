import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { listReviewTemplates, type ReviewListFilters } from "@/lib/admin/queries";
import { hasSevereWarnings } from "@/lib/templates/select";
import { getSubjects, getBatches } from "@/lib/data/catalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewFilters } from "@/components/admin/ReviewFilters";
import { AlertTriangle, ClipboardCheck, FileText, ShieldAlert } from "lucide-react";
import type { TemplateStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const VALID_STATUS: TemplateStatus[] = ["pending", "approved", "rejected"];

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const getStr = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };

  const supabase = createServerClient();
  if (!supabase) {
    return (
      <EmptyState
        icon={<AlertTriangle className="w-8 h-8" />}
        title="Database not configured"
        description="Supabase environment variables are missing."
      />
    );
  }

  const statusParam = getStr("status");
  const status = (VALID_STATUS as string[]).includes(statusParam ?? "pending")
    ? ((statusParam ?? "pending") as TemplateStatus)
    : "pending";

  const assignmentStr = getStr("assignment");
  const filters: ReviewListFilters = {
    status,
    subjectSlug: getStr("subject"),
    batchName: getStr("batch"),
    sourceFormat: getStr("format"),
    assignmentNumber: assignmentStr ? Number(assignmentStr) : undefined,
  };

  const [items, subjects, batches] = await Promise.all([
    listReviewTemplates(supabase, filters, hasSevereWarnings),
    getSubjects(),
    getBatches(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Review queue"
        description="Templates awaiting moderation. Items needing review and residual-leak risks are flagged first."
        backHref="/admin"
        backLabel="Dashboard"
      />

      <ReviewFilters
        subjects={subjects.map((s) => ({ slug: s.slug, name: s.name }))}
        batches={batches.map((b) => b.name)}
        current={{
          status,
          subject: filters.subjectSlug,
          assignment: assignmentStr,
          batch: filters.batchName,
          format: filters.sourceFormat,
        }}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="w-8 h-8" />}
          title="Nothing here"
          description="No templates match these filters."
        />
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <Link key={t.id} href={`/admin/review/${t.id}`} className="block">
              <Card hoverable>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {t.subjectName} — Assignment {t.assignmentNumber}
                    </div>
                    <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>Batch {t.batchName}</span>
                      <span>·</span>
                      <span className="uppercase">{t.sourceFormat}</span>
                      <span>·</span>
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.hasSevere && (
                      <Badge variant="danger" className="gap-1">
                        <ShieldAlert className="w-3 h-3" /> Leak risk
                      </Badge>
                    )}
                    {t.needsReview && <Badge variant="warning">Needs review</Badge>}
                    {t.convertedFromPdf && <Badge variant="outline">PDF</Badge>}
                    {t.reportCount > 0 && <Badge variant="danger">{t.reportCount} reports</Badge>}
                    <Badge
                      variant={
                        t.status === "approved"
                          ? "success"
                          : t.status === "rejected"
                          ? "danger"
                          : "indigo"
                      }
                    >
                      {t.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
