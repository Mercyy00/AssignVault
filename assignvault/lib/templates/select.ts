import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TemplateRecord = Database["public"]["Tables"]["templates"]["Row"];

/**
 * Check if a warning list contains any severe warnings.
 * Severe warnings include residual leaks or unreplaced identification tokens.
 */
export function hasSevereWarnings(warnings: unknown): boolean {
  if (!Array.isArray(warnings)) return false;
  return warnings.some((w) => {
    const text =
      typeof w === "string"
        ? w
        : w && typeof w === "object" && "message" in w
        ? String((w as { message: unknown }).message)
        : "";
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes("residual") ||
      lower.includes("corrupt") ||
      lower.includes("failed") ||
      lower.includes("not detected") ||
      lower.includes("not found")
    );
  });
}

/**
 * Compare two approved templates to select the best one:
 * 1. Lowest report_count ascending.
 * 2. Fewer or no severe warnings preferred.
 * 3. Most recent approved_at descending.
 */
export function compareTemplates(a: TemplateRecord, b: TemplateRecord): number {
  // 0. Admin-pinned templates always win.
  const pinnedA = a.pinned ? 1 : 0;
  const pinnedB = b.pinned ? 1 : 0;
  if (pinnedA !== pinnedB) {
    return pinnedB - pinnedA;
  }

  // 1. Lowest report_count first
  const reportA = a.report_count ?? 0;
  const reportB = b.report_count ?? 0;
  if (reportA !== reportB) {
    return reportA - reportB;
  }

  // 2. No severe warnings preferred
  const severeA = hasSevereWarnings(a.warnings) ? 1 : 0;
  const severeB = hasSevereWarnings(b.warnings) ? 1 : 0;
  if (severeA !== severeB) {
    return severeA - severeB;
  }

  // 3. Most recent approved_at descending
  const dateA = a.approved_at ? new Date(a.approved_at).getTime() : 0;
  const dateB = b.approved_at ? new Date(b.approved_at).getTime() : 0;
  return dateB - dateA;
}

/**
 * Query Supabase to find the best approved template for a given assignment ID.
 */
export async function selectBestTemplate(
  supabase: SupabaseClient<Database>,
  assignmentId: string
): Promise<TemplateRecord | null> {
  const { data: templates, error } = await supabase
    .from("templates")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("status", "approved");

  if (error || !templates || templates.length === 0) {
    return null;
  }

  // Sort candidates according to the selection policy
  const sorted = [...templates].sort(compareTemplates);
  return sorted[0];
}
