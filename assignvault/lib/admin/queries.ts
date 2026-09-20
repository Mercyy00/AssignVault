import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TemplateStatus } from "@/types/database";
import { computeGaps, type AssignmentRef, type GapGroup } from "@/lib/admin/gaps";

type DB = SupabaseClient<Database>;

export interface DashboardStats {
  pendingTemplates: number;
  needsReview: number;
  reportedTemplates: number;
  uploadsThisWeek: number;
  downloadsThisWeek: number;
  gaps: GapGroup[];
}

function weekAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Dashboard summary. Uses head:true count queries so we never pull full rows
 * just to count them. Gaps are computed from assignments vs. the set of
 * assignment_ids that have at least one APPROVED template.
 */
export async function getDashboardStats(supabase: DB): Promise<DashboardStats> {
  const since = weekAgoIso();

  const [
    pending,
    needsReview,
    reported,
    uploads,
    downloads,
    assignmentsRes,
    approvedRes,
  ] = await Promise.all([
    supabase.from("templates").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("needs_review", true),
    supabase.from("templates").select("id", { count: "exact", head: true }).gt("report_count", 0),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("downloads_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("assignments")
      .select("id, number, subject_id, subjects(slug, name)")
      .order("number", { ascending: true }),
    supabase.from("templates").select("assignment_id").eq("status", "approved"),
  ]);

  const approvedIds = new Set(
    (approvedRes.data || []).map((r) => (r as { assignment_id: string }).assignment_id)
  );

  const assignments: AssignmentRef[] = (assignmentsRes.data || []).map((a) => {
    const row = a as unknown as {
      id: string;
      number: number;
      subjects: { slug: string; name: string } | { slug: string; name: string }[] | null;
    };
    const subj = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    return {
      id: row.id,
      number: row.number,
      subjectSlug: subj?.slug ?? "unknown",
      subjectName: subj?.name ?? "Unknown subject",
    };
  });

  return {
    pendingTemplates: pending.count ?? 0,
    needsReview: needsReview.count ?? 0,
    reportedTemplates: reported.count ?? 0,
    uploadsThisWeek: uploads.count ?? 0,
    downloadsThisWeek: downloads.count ?? 0,
    gaps: computeGaps(assignments, approvedIds),
  };
}

export interface ReviewListItem {
  id: string;
  status: TemplateStatus;
  needsReview: boolean;
  convertedFromPdf: boolean;
  reportCount: number;
  createdAt: string;
  approvedAt: string | null;
  hasSevere: boolean;
  subjectSlug: string;
  subjectName: string;
  assignmentNumber: number;
  batchName: string;
  sourceFormat: string;
}

export interface ReviewListFilters {
  status?: TemplateStatus;
  subjectSlug?: string;
  assignmentNumber?: number;
  batchName?: string;
  sourceFormat?: string;
}

// Shape of a template row joined with its relations for list/detail rendering.
type JoinedTemplateRow = {
  id: string;
  status: TemplateStatus;
  needs_review: boolean;
  converted_from_pdf: boolean;
  report_count: number;
  warnings: unknown;
  created_at: string;
  approved_at: string | null;
  assignments: { number: number; subjects: { slug: string; name: string } | null } | null;
  batches: { name: string } | null;
  submissions: { source_format: string } | null;
};

/**
 * List templates for the review queue, flagged needs_review first, then newest.
 * Filtering by subject/assignment/batch/source is done in-memory on the joined
 * result set (the volume is small — a class's worth of submissions).
 */
export async function listReviewTemplates(
  supabase: DB,
  filters: ReviewListFilters = {},
  hasSevereWarnings: (w: unknown) => boolean
): Promise<ReviewListItem[]> {
  let query = supabase
    .from("templates")
    .select(
      `id, status, needs_review, converted_from_pdf, report_count, warnings, created_at, approved_at,
       assignments(number, subjects(slug, name)),
       batches(name),
       submissions(source_format)`
    )
    .order("needs_review", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let items: ReviewListItem[] = (data || []).map((raw) => {
    const row = raw as unknown as JoinedTemplateRow;
    const subj = row.assignments?.subjects ?? null;
    return {
      id: row.id,
      status: row.status,
      needsReview: row.needs_review,
      convertedFromPdf: row.converted_from_pdf,
      reportCount: row.report_count,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      hasSevere: hasSevereWarnings(row.warnings),
      subjectSlug: subj?.slug ?? "unknown",
      subjectName: subj?.name ?? "Unknown",
      assignmentNumber: row.assignments?.number ?? 0,
      batchName: row.batches?.name ?? "—",
      sourceFormat: row.submissions?.source_format ?? "docx",
    };
  });

  if (filters.subjectSlug) items = items.filter((i) => i.subjectSlug === filters.subjectSlug);
  if (filters.assignmentNumber != null)
    items = items.filter((i) => i.assignmentNumber === filters.assignmentNumber);
  if (filters.batchName) items = items.filter((i) => i.batchName === filters.batchName);
  if (filters.sourceFormat) items = items.filter((i) => i.sourceFormat === filters.sourceFormat);

  return items;
}

export interface TemplateDetail {
  id: string;
  status: TemplateStatus;
  needsReview: boolean;
  convertedFromPdf: boolean;
  reportCount: number;
  rejectedReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  pinned: boolean;
  requiresFolder: boolean;
  filePath: string | null;
  placeholderCounts: unknown;
  warnings: unknown;
  outputImages: unknown;
  assignmentId: string;
  assignmentNumber: number;
  subjectSlug: string;
  subjectName: string;
  batchName: string;
  // Uploader details come from the linked submission (admin-only PII).
  submissionId: string;
  uploaderName: string;
  uploaderRoll: string;
  uploaderFolder: string;
  uploaderDate: string;
  sourceFormat: string;
  rawFilePath: string | null;
  convertedDocxPath: string | null;
  terminalOutputText: string | null;
}

export async function getTemplateDetail(
  supabase: DB,
  templateId: string
): Promise<TemplateDetail | null> {
  const { data, error } = await supabase
    .from("templates")
    .select(
      `id, status, needs_review, converted_from_pdf, report_count, rejected_reason,
       approved_at, created_at, pinned, requires_folder, file_path, placeholder_counts,
       warnings, output_images, assignment_id,
       assignments(number, subjects(slug, name)),
       batches(name),
       submissions(id, uploader_name, uploader_roll, uploader_folder, uploader_date,
                   source_format, raw_file_path, converted_docx_path, terminal_output_text)`
    )
    .eq("id", templateId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    status: TemplateStatus;
    needs_review: boolean;
    converted_from_pdf: boolean;
    report_count: number;
    rejected_reason: string | null;
    approved_at: string | null;
    created_at: string;
    pinned: boolean;
    requires_folder: boolean;
    file_path: string | null;
    placeholder_counts: unknown;
    warnings: unknown;
    output_images: unknown;
    assignment_id: string;
    assignments: { number: number; subjects: { slug: string; name: string } | null } | null;
    batches: { name: string } | null;
    submissions: {
      id: string;
      uploader_name: string;
      uploader_roll: string;
      uploader_folder: string;
      uploader_date: string;
      source_format: string;
      raw_file_path: string | null;
      converted_docx_path: string | null;
      terminal_output_text: string | null;
    } | null;
  };

  const subj = row.assignments?.subjects ?? null;
  const sub = row.submissions;

  return {
    id: row.id,
    status: row.status,
    needsReview: row.needs_review,
    convertedFromPdf: row.converted_from_pdf,
    reportCount: row.report_count,
    rejectedReason: row.rejected_reason,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    pinned: row.pinned,
    requiresFolder: row.requires_folder,
    filePath: row.file_path,
    placeholderCounts: row.placeholder_counts,
    warnings: row.warnings,
    outputImages: row.output_images,
    assignmentId: row.assignment_id,
    assignmentNumber: row.assignments?.number ?? 0,
    subjectSlug: subj?.slug ?? "unknown",
    subjectName: subj?.name ?? "Unknown",
    batchName: row.batches?.name ?? "—",
    submissionId: sub?.id ?? "",
    uploaderName: sub?.uploader_name ?? "",
    uploaderRoll: sub?.uploader_roll ?? "",
    uploaderFolder: sub?.uploader_folder ?? "",
    uploaderDate: sub?.uploader_date ?? "",
    sourceFormat: sub?.source_format ?? "docx",
    rawFilePath: sub?.raw_file_path ?? null,
    convertedDocxPath: sub?.converted_docx_path ?? null,
    terminalOutputText: sub?.terminal_output_text ?? null,
  };
}
