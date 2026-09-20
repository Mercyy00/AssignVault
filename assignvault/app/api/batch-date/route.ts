import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getDate } from "@/lib/data/batchDates";
import { formatDate } from "@/lib/docx/fill";
import { DEFAULT_DATE_FORMAT } from "@/lib/dates/dateUtils";

export const dynamic = "force-dynamic";

/**
 * GET /api/batch-date?subject=<slug>&assignment=<number>&batch=<name>
 * Public endpoint used by the download page to show the published date for the
 * chosen batch. Returns { date: ISO|null, display: string|null }.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subjectSlug = searchParams.get("subject");
  const assignmentStr = searchParams.get("assignment");
  const batchName = searchParams.get("batch");

  if (!subjectSlug || !assignmentStr || !batchName) {
    return NextResponse.json(
      { date: null, display: null },
      { status: 200 }
    );
  }

  const assignmentNumber = parseInt(assignmentStr, 10);
  if (isNaN(assignmentNumber) || assignmentNumber < 1) {
    return NextResponse.json({ date: null, display: null }, { status: 200 });
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ date: null, display: null }, { status: 200 });
  }

  const { data: subject } = await supabase
    .from("subjects")
    .select("id")
    .eq("slug", subjectSlug)
    .maybeSingle();
  if (!subject) {
    return NextResponse.json({ date: null, display: null }, { status: 200 });
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id")
    .eq("subject_id", subject.id)
    .eq("number", assignmentNumber)
    .maybeSingle();
  if (!assignment) {
    return NextResponse.json({ date: null, display: null }, { status: 200 });
  }

  const { data: batch } = await supabase
    .from("batches")
    .select("id")
    .eq("name", batchName)
    .maybeSingle();
  if (!batch) {
    return NextResponse.json({ date: null, display: null }, { status: 200 });
  }

  const iso = await getDate(supabase, batch.id, assignment.id);
  if (!iso) {
    return NextResponse.json({ date: null, display: null }, { status: 200 });
  }

  return NextResponse.json({
    date: iso,
    display: formatDate(iso, DEFAULT_DATE_FORMAT),
  });
}
