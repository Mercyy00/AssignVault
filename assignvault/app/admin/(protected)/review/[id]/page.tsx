import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getTemplateDetail } from "@/lib/admin/queries";
import { hasSevereWarnings } from "@/lib/templates/select";
import { approvalBlockers } from "@/lib/admin/moderation";
import { scanResidualLeaks } from "@/lib/docx/report";
import { downloadObject, createSignedUrl } from "@/lib/storage/signedUrls";
import { renderTemplatePreview } from "@/lib/admin/preview";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { TemplateActions } from "@/components/admin/TemplateActions";
import { ShieldAlert, ShieldCheck, AlertTriangle, FileText, Download, ArrowLeft } from "lucide-react";
import JSZip from "jszip";
import type { PlaceholderCounts } from "@/lib/docx/report";

export const dynamic = "force-dynamic";

type WarningItem = string | { message: string; type?: string; excerpt?: string };

function warningText(w: WarningItem): string {
  return typeof w === "string" ? w : w.message;
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerClient();
  if (!supabase) notFound();

  const detail = await getTemplateDetail(supabase, id);
  if (!detail) notFound();

  // Load the template docx to render a preview and re-scan for residual leaks
  // against the uploader's own identity (the headline privacy check).
  let previewHtml = "";
  let previewError: string | null = null;
  let liveResidualLeaks: string[] = [];
  let templateSignedUrl: string | null = null;

  if (detail.filePath) {
    const { buffer, error } = await downloadObject(supabase, "templates", detail.filePath);
    if (error || !buffer) {
      previewError = "Could not load the template file from storage.";
    } else {
      try {
        const preview = await renderTemplatePreview(buffer);
        previewHtml = preview.html;
      } catch {
        previewError = "Could not render a preview of this document.";
      }
      // Live residual-leak scan using the uploader's real details.
      try {
        const zip = await JSZip.loadAsync(buffer);
        liveResidualLeaks = await scanResidualLeaks(zip, {
          fullName: detail.uploaderName,
          rollNumber: detail.uploaderRoll,
          batch: detail.batchName,
          folderName: detail.uploaderFolder,
          fileDate: detail.uploaderDate,
        });
      } catch {
        // Non-fatal: fall back to stored warnings below.
      }
    }
    const signed = await createSignedUrl(supabase, "templates", detail.filePath, 300);
    templateSignedUrl = signed.url;
  } else {
    previewError = "This template has no stored file.";
  }

  const rawSigned = detail.rawFilePath
    ? await createSignedUrl(supabase, "raw-uploads", detail.rawFilePath, 300)
    : { url: null, error: null };

  const warnings = (Array.isArray(detail.warnings) ? detail.warnings : []) as WarningItem[];
  const storedSevere = hasSevereWarnings(detail.warnings);
  const hasLiveLeak = liveResidualLeaks.length > 0;
  const leakRisk = storedSevere || hasLiveLeak;

  const counts = (detail.placeholderCounts || {}) as PlaceholderCounts;
  const blockers = approvalBlockers(counts, leakRisk);

  const placeholderTypes = Object.keys(counts);

  return (
    <div className="space-y-5">
      <Link
        href="/admin/review"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="w-4 h-4" /> Back to queue
      </Link>

      <PageHeader
        title={`${detail.subjectName} — Assignment ${detail.assignmentNumber}`}
        description={`Batch ${detail.batchName} · ${detail.sourceFormat.toUpperCase()} · uploaded ${new Date(
          detail.createdAt
        ).toLocaleString()}`}
        backHref=""
      >
        <Badge
          variant={
            detail.status === "approved"
              ? "success"
              : detail.status === "rejected"
              ? "danger"
              : "indigo"
          }
        >
          {detail.status}
        </Badge>
      </PageHeader>

      {/* HEADLINE: residual identity-leak check — the core zero-trace guarantee */}
      <Card
        className={
          leakRisk
            ? "border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20"
            : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20"
        }
      >
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                leakRisk
                  ? "bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300"
                  : "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300"
              }`}
            >
              {leakRisk ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold">
                {leakRisk
                  ? "Residual identity leak detected"
                  : "No residual identity detected"}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                {leakRisk
                  ? "The template may still contain traces of the original uploader. Do NOT approve until this is resolved — re-run templating with corrected details, or reject."
                  : "The uploader's name, roll number and folder were not found in the template body. Safe from a traceability standpoint."}
              </p>
              {hasLiveLeak && (
                <ul className="mt-2 space-y-1 text-xs text-rose-700 dark:text-rose-300">
                  {liveResidualLeaks.map((l, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: uploader details + placeholder counts + warnings */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardContent className="py-4 space-y-3">
              <h3 className="font-semibold text-sm">Uploader details</h3>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 -mt-1">
                Personal data — admin only.
              </p>
              <dl className="text-sm space-y-1.5">
                <Row label="Name" value={detail.uploaderName} />
                <Row label="Roll" value={detail.uploaderRoll} />
                <Row label="Folder" value={detail.uploaderFolder || "—"} />
                <Row label="Doc date" value={detail.uploaderDate} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 space-y-2">
              <h3 className="font-semibold text-sm">Placeholders detected</h3>
              {placeholderTypes.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  None detected — personalization may not work.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {placeholderTypes.map((t) => (
                    <Badge key={t} variant="indigo">
                      {t}: {counts[t]?.total ?? 0}
                    </Badge>
                  ))}
                </div>
              )}
              {detail.requiresFolder && (
                <p className="text-xs text-zinc-500 mt-1">
                  Requires a folder name at download time.
                </p>
              )}
            </CardContent>
          </Card>

          {warnings.length > 0 && (
            <Card>
              <CardContent className="py-4 space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Warnings
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {warnings.map((w, i) => {
                    const text = warningText(w);
                    const severe = hasSevereWarnings([w]);
                    return (
                      <li
                        key={i}
                        className={`rounded-md px-2 py-1.5 ${
                          severe
                            ? "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                            : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {text}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* File links (signed, short-lived) */}
          <Card>
            <CardContent className="py-4 space-y-2">
              <h3 className="font-semibold text-sm">Files</h3>
              <div className="flex flex-col gap-2">
                {templateSignedUrl && (
                  <a
                    href={templateSignedUrl}
                    className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Download className="w-4 h-4" /> Download template (.docx)
                  </a>
                )}
                {rawSigned.url ? (
                  <a
                    href={rawSigned.url}
                    className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:underline"
                  >
                    <FileText className="w-4 h-4" /> Original upload (raw)
                  </a>
                ) : (
                  <span className="text-xs text-zinc-400">
                    Raw upload {detail.rawFilePath ? "unavailable" : "deleted for privacy"}.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: preview + actions */}
        <div className="lg:col-span-2 space-y-4">
          <TemplateActions
            templateId={detail.id}
            status={detail.status}
            pinned={detail.pinned}
            leakRisk={leakRisk}
            blockers={blockers}
            uploader={{
              fullName: detail.uploaderName,
              rollNumber: detail.uploaderRoll,
              batch: detail.batchName,
              folderName: detail.uploaderFolder,
              fileDate: detail.uploaderDate,
            }}
          />

          <Card>
            <CardContent className="py-4">
              <h3 className="font-semibold text-sm mb-2">Rendered preview</h3>
              <p className="text-xs text-zinc-500 mb-3">
                Highlighted tokens like <mark className="av-ph">{"{{NAME}}"}</mark> show where
                personalization is injected. Headers/footers are not shown here — see placeholder
                counts.
              </p>
              {previewError ? (
                <div className="text-sm text-rose-600 dark:text-rose-400">{previewError}</div>
              ) : (
                <div
                  className="av-preview max-w-none text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 max-h-[600px] overflow-y-auto bg-white dark:bg-zinc-900"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="font-medium text-right break-words">{value}</dd>
    </div>
  );
}
