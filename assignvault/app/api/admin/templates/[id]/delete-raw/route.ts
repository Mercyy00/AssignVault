import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/templates/:id/delete-raw
 * Privacy hygiene: removes the ORIGINAL uploaded file(s) from the raw-uploads
 * bucket and nulls the submission's raw_file_path / converted_docx_path, while
 * KEEPING the generated template. Once done, the source that could tie the
 * template back to its uploader is gone.
 *
 * Idempotent: if the raw file is already gone, it still clears the paths.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server database configuration is missing" }, { status: 500 });
  }

  const { data: template } = await supabase
    .from("templates")
    .select("id, submission_id")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  const submissionId = (template as { submission_id: string }).submission_id;

  const { data: submission } = await supabase
    .from("submissions")
    .select("raw_file_path, converted_docx_path")
    .eq("id", submissionId)
    .maybeSingle();

  const sub = submission as {
    raw_file_path: string | null;
    converted_docx_path: string | null;
  } | null;

  const pathsToRemove = [sub?.raw_file_path, sub?.converted_docx_path].filter(
    (p): p is string => !!p
  );

  if (pathsToRemove.length > 0) {
    const { error: rmError } = await supabase.storage.from("raw-uploads").remove(pathsToRemove);
    if (rmError) {
      return NextResponse.json(
        { error: `Failed to remove raw file(s): ${rmError.message}` },
        { status: 500 }
      );
    }
  }

  const { error: updErr } = await supabase
    .from("submissions")
    .update({ raw_file_path: null, converted_docx_path: null } as never)
    .eq("id", submissionId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await supabase.from("audit_log").insert({
    actor: auth.session.userId,
    action: "raw_upload_deleted",
    details: { template_id: id, submission_id: submissionId, removed_paths: pathsToRemove.length },
  } as never);

  return NextResponse.json({ ok: true, removed: pathsToRemove.length });
}
