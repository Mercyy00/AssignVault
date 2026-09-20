import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { createServerClient } from "@/lib/supabase/server";
import { downloadObject } from "@/lib/storage/signedUrls";
import { fillTemplate } from "@/lib/docx/fill";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional().or(z.literal("")),
  surname: z.string().min(1).max(100),
  rollNumber: z.string().min(1).max(50),
  batch: z.string().min(1).max(100),
  folderName: z.string().max(100).optional().or(z.literal("")),
  customDate: z.string().max(20).optional().or(z.literal("")),
});

/**
 * POST /api/admin/templates/:id/test-generate
 * Fills the template with admin-supplied SAMPLE details and streams the .docx
 * so the reviewer can open it in Word before approving. Does NOT touch
 * downloads_log (this is a review action, not a real download).
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
    .select("id, file_path")
    .eq("id", id)
    .maybeSingle();

  const filePath = (template as { file_path: string | null } | null)?.file_path;
  if (!template || !filePath) {
    return NextResponse.json({ error: "Template file not found." }, { status: 404 });
  }

  const { buffer, error: dlError } = await downloadObject(supabase, "templates", filePath);
  if (dlError || !buffer) {
    return NextResponse.json({ error: "Failed to load template from storage." }, { status: 500 });
  }

  const d = parsed.data;
  let filled: Buffer;
  try {
    filled = await fillTemplate(buffer, {
      firstName: d.firstName,
      middleName: d.middleName || "",
      surname: d.surname,
      rollNumber: d.rollNumber,
      batch: d.batch,
      customDate: d.customDate || undefined,
      folderName: d.folderName || "assign",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fill failed." },
      { status: 422 }
    );
  }

  await supabase.from("audit_log").insert({
    actor: auth.session.userId,
    action: "template_test_generate",
    details: { template_id: id },
  } as never);

  return new NextResponse(new Uint8Array(filled), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="test_${d.rollNumber || "sample"}.docx"`,
    },
  });
}
