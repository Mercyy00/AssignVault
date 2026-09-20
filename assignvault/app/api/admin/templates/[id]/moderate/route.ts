import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { createServerClient } from "@/lib/supabase/server";
import { applyModeration, type ModerationAction } from "@/lib/admin/moderation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["approve", "reject", "reset_pending", "pin", "unpin"]),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/admin/templates/:id/moderate
 * Body: { action, reason? }
 *
 * approve/reject/reset_pending run the pure moderation state machine.
 * pin/unpin toggle the preferred-template flag (pin requires an approved
 * template and unpins any sibling for the same assignment first).
 * Every action writes an audit_log entry with the acting admin as `actor`.
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

  const { data: current } = await supabase
    .from("templates")
    .select("id, status, assignment_id, pinned")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const row = current as {
    id: string;
    status: "pending" | "approved" | "rejected";
    assignment_id: string;
    pinned: boolean;
  };
  const { action, reason } = parsed.data;

  // ---- Pin / unpin -------------------------------------------------------
  if (action === "pin" || action === "unpin") {
    if (action === "pin" && row.status !== "approved") {
      return NextResponse.json(
        { error: "Only an approved template can be pinned as preferred." },
        { status: 400 }
      );
    }
    if (action === "pin") {
      // Ensure a single pinned template per assignment.
      await supabase
        .from("templates")
        .update({ pinned: false } as never)
        .eq("assignment_id", row.assignment_id)
        .neq("id", id);
    }
    const { error } = await supabase
      .from("templates")
      .update({ pinned: action === "pin" } as never)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("audit_log").insert({
      actor: auth.session.userId,
      action: `template_${action}`,
      details: { template_id: id, assignment_id: row.assignment_id },
    } as never);

    return NextResponse.json({ ok: true, pinned: action === "pin" });
  }

  // ---- Approve / reject / reset_pending ---------------------------------
  let result;
  try {
    result = applyModeration({ status: row.status }, action as ModerationAction, { reason });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid moderation action." },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {
    status: result.status,
    approved_at: result.approvedAt,
    rejected_reason: result.rejectedReason,
    needs_review: result.needsReview,
  };
  // A rejected template must never remain pinned/served.
  if (result.status !== "approved") patch.pinned = false;

  const { error } = await supabase.from("templates").update(patch as never).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor: auth.session.userId,
    action: `template_${action}`,
    details: { template_id: id, assignment_id: row.assignment_id, reason: reason ?? null },
  } as never);

  return NextResponse.json({ ok: true, status: result.status });
}
