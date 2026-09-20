import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { bulkSet, clear, getDatesForAssignments } from "@/lib/data/batchDates";
import { isValidIsoDate } from "@/lib/dates/dateUtils";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/batch-dates?subject=<slug>
 * Returns the assignments + batches grid data and the published dates map.
 * Requires the temporary admin key header (Step 8; TODO real auth in Step 9).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const subjectSlug = new URL(request.url).searchParams.get("subject");
  if (!subjectSlug) {
    return NextResponse.json(
      { error: "Missing required query parameter: subject" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server database configuration is missing" },
      { status: 500 }
    );
  }

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, slug, name")
    .eq("slug", subjectSlug)
    .maybeSingle();

  if (!subject) {
    return NextResponse.json({ error: "Unknown subject" }, { status: 404 });
  }

  const [{ data: assignments }, { data: batches }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, number")
      .eq("subject_id", subject.id)
      .order("number", { ascending: true }),
    supabase
      .from("batches")
      .select("id, name")
      .order("sort_order", { ascending: true }),
  ]);

  const assignmentIds = (assignments || []).map((a) => a.id);
  const dates = await getDatesForAssignments(supabase, assignmentIds);

  return NextResponse.json({
    subject: { id: subject.id, slug: subject.slug, name: subject.name },
    assignments: assignments || [],
    batches: batches || [],
    dates,
  });
}

const entrySchema = z.object({
  batchId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  date: z.string().refine(isValidIsoDate, "Invalid ISO date"),
});
const clearEntrySchema = z.object({
  batchId: z.string().uuid(),
  assignmentId: z.string().uuid(),
});
const bodySchema = z.object({
  set: z.array(entrySchema).max(2000).optional(),
  clear: z.array(clearEntrySchema).max(2000).optional(),
});

/**
 * POST /api/admin/batch-dates
 * Body: { set?: [{batchId, assignmentId, date}], clear?: [{batchId, assignmentId}] }
 * Upserts and/or deletes batch dates. Requires the temporary admin key header.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server database configuration is missing" },
      { status: 500 }
    );
  }

  const { set = [], clear: clears = [] } = parsed.data;

  let setCount = 0;
  let clearCount = 0;

  if (set.length > 0) {
    const res = await bulkSet(
      supabase,
      set.map((e) => ({
        batchId: e.batchId,
        assignmentId: e.assignmentId,
        date: e.date,
      }))
    );
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    setCount = res.count;
  }

  if (clears.length > 0) {
    const res = await clear(supabase, clears);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    clearCount = res.count;
  }

  await supabase.from("audit_log").insert({
    action: "batch_dates_updated",
    details: { set: setCount, cleared: clearCount },
  });

  return NextResponse.json({ ok: true, setCount, clearCount });
}
