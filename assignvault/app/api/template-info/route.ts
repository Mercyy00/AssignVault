import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { selectBestTemplate } from "@/lib/templates/select";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectSlug = searchParams.get("subject");
    const assignmentNumStr = searchParams.get("assignment");

    if (!subjectSlug || !assignmentNumStr) {
      return NextResponse.json(
        { error: "Missing required query parameters: subject and assignment" },
        { status: 400 }
      );
    }

    const assignmentNumber = parseInt(assignmentNumStr, 10);
    if (isNaN(assignmentNumber) || assignmentNumber < 1) {
      return NextResponse.json(
        { error: "Invalid assignment number" },
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

    // 1. Resolve subject
    const { data: subjectRecord } = await supabase
      .from("subjects")
      .select("id")
      .eq("slug", subjectSlug)
      .maybeSingle();

    if (!subjectRecord) {
      return NextResponse.json(
        { available: false, requiresFolder: false, blockCount: 0, warnings: [] },
        { status: 200 }
      );
    }

    // 2. Resolve assignment
    const { data: assignmentRecord } = await supabase
      .from("assignments")
      .select("id")
      .eq("subject_id", subjectRecord.id)
      .eq("number", assignmentNumber)
      .maybeSingle();

    if (!assignmentRecord) {
      return NextResponse.json(
        { available: false, requiresFolder: false, blockCount: 0, warnings: [] },
        { status: 200 }
      );
    }

    // 3. Find the best approved template
    const bestTemplate = await selectBestTemplate(supabase, assignmentRecord.id);

    if (!bestTemplate) {
      return NextResponse.json(
        { available: false, requiresFolder: false, blockCount: 0, warnings: [] },
        { status: 200 }
      );
    }

    // 4. Extract template capabilities
    const placeholderCounts = (bestTemplate.placeholder_counts || {}) as Record<
      string,
      { total?: number }
    >;
    const requiresFolder = Boolean(
      placeholderCounts.FOLDER && (placeholderCounts.FOLDER.total ?? 0) > 0
    );
    const blockCount = placeholderCounts.ROLL?.total ?? 1;
    const warnings = Array.isArray(bestTemplate.warnings) ? bestTemplate.warnings : [];

    return NextResponse.json({
      available: true,
      templateId: bestTemplate.id,
      requiresFolder,
      blockCount,
      warnings,
    });
  } catch (error) {
    console.error("Error in /api/template-info:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while fetching template info" },
      { status: 500 }
    );
  }
}
