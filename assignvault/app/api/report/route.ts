import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const { templateId, reason } = body;

    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server database configuration is missing" },
        { status: 500 }
      );
    }

    // 1. Fetch current template report_count
    const { data: template, error: fetchErr } = await supabase
      .from("templates")
      .select("id, report_count, needs_review")
      .eq("id", templateId)
      .maybeSingle();

    if (fetchErr || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const newReportCount = (template.report_count || 0) + 1;
    const shouldReview = newReportCount >= 3 || template.needs_review;

    // 2. Update templates table
    const { error: updateErr } = await supabase
      .from("templates")
      .update({
        report_count: newReportCount,
        needs_review: shouldReview,
      } as never)
      .eq("id", templateId);

    if (updateErr) {
      console.error("Failed to update report count:", updateErr);
      return NextResponse.json(
        { error: "Failed to record report" },
        { status: 500 }
      );
    }

    // 3. Log to audit_log
    await supabase.from("audit_log").insert({
      action: "template_reported",
      details: {
        template_id: templateId,
        reason: reason || "User reported an issue from download page",
        report_count: newReportCount,
        needs_review: shouldReview,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for reporting. Our reviewers will inspect this document.",
      reportCount: newReportCount,
    });
  } catch (error) {
    console.error("Error in /api/report:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while reporting the file" },
      { status: 500 }
    );
  }
}
