import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { createServerClient } from "@/lib/supabase/server";
import { downloadObject } from "@/lib/storage/signedUrls";
import { templatize } from "@/lib/docx/templatize";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  // Corrected uploader details used to re-detect and scrub identity.
  fullName: z.string().min(1).max(200),
  rollNumber: z.string().min(1).max(50),
  batch: z.string().min(1).max(100),
  folderName: z.string().max(100).optional().or(z.literal("")),
  fileDate: z.string().min(1).max(20),
});

/**
 * POST /api/admin/templates/:id/rerun
 * Re-runs templatization on the ORIGINAL uploaded docx (or the converted docx
 * for PDF sources) using corrected uploader details, then overwrites the
 * template file + report/counts/warnings. Used when the automatic detection
 * missed a name variant and left a residual identity leak.
 *
 * The template returns to `pending` so a human re-checks the fresh scrub result
 * before it can be served.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server database configuration is missing" }, { status: 500 });
  }

  const { data: template } = await supabase
    .from("templates")
    .select("id, file_path, submission_id, converted_from_pdf")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  const tpl = template as {
    id: string;
    file_path: string | null;
    submission_id: string;
    converted_from_pdf: boolean;
  };

  const { data: submission } = await supabase
    .from("submissions")
    .select("raw_file_path, converted_docx_path, source_format")
    .eq("id", tpl.submission_id)
    .maybeSingle();

  const sub = submission as {
    raw_file_path: string | null;
    converted_docx_path: string | null;
    source_format: string;
  } | null;

  // Choose the docx source: converted docx for PDFs, else the original upload.
  const sourcePath =
    sub?.source_format === "pdf" ? sub?.converted_docx_path : sub?.raw_file_path;
  if (!sub || !sourcePath) {
    return NextResponse.json(
      { error: "The original upload is no longer available (raw file may have been deleted)." },
      { status: 409 }
    );
  }

  const { buffer, error: dlError } = await downloadObject(supabase, "raw-uploads", sourcePath);
  if (dlError || !buffer) {
    return NextResponse.json({ error: "Failed to load the original upload." }, { status: 500 });
  }

  const d = parsed.data;
  let result;
  try {
    result = await templatize(
      buffer,
      {
        fullName: d.fullName,
        rollNumber: d.rollNumber,
        batch: d.batch,
        folderName: d.folderName || "",
        fileDate: d.fileDate,
      },
      { isConvertedFromPdf: sub.source_format === "pdf" }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Re-templatization failed." },
      { status: 422 }
    );
  }

  // Overwrite the existing template file (same path) so downloads stay valid.
  const filePath = tpl.file_path || `${tpl.id}/template.docx`;
  const { error: upErr } = await supabase.storage
    .from("templates")
    .upload(filePath, result.templateBuffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });
  if (upErr) {
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from("templates")
    .update({
      file_path: filePath,
      status: "pending",
      approved_at: null,
      pinned: false,
      placeholder_counts: result.report.placeholderCounts,
      warnings: result.report.warnings,
      output_images: result.report.outputImages,
      needs_review: result.needsReview,
      requires_folder: result.requiresFolder,
    } as never)
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    actor: auth.session.userId,
    action: "template_rerun",
    details: { template_id: id, roll_number: d.rollNumber, needs_review: result.needsReview },
  } as never);

  return NextResponse.json({
    ok: true,
    needsReview: result.needsReview,
    warnings: result.report.warnings,
    placeholderCounts: result.report.placeholderCounts,
  });
}
