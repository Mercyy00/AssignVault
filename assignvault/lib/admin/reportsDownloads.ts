import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TemplateStatus } from "@/types/database";

type DB = SupabaseClient<Database>;

export interface ReportedTemplate {
  id: string;
  status: TemplateStatus;
  reportCount: number;
  createdAt: string;
  subjectName: string;
  subjectSlug: string;
  assignmentNumber: number;
  batchName: string;
}

/** Templates with report_count > 0, most-reported first. */
export async function listReportedTemplates(supabase: DB): Promise<ReportedTemplate[]> {
  const { data, error } = await supabase
    .from("templates")
    .select(
      `id, status, report_count, created_at,
       assignments(number, subjects(slug, name)),
       batches(name)`
    )
    .gt("report_count", 0)
    .order("report_count", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((raw) => {
    const row = raw as unknown as {
      id: string;
      status: TemplateStatus;
      report_count: number;
      created_at: string;
      assignments: { number: number; subjects: { slug: string; name: string } | null } | null;
      batches: { name: string } | null;
    };
    const subj = row.assignments?.subjects ?? null;
    return {
      id: row.id,
      status: row.status,
      reportCount: row.report_count,
      createdAt: row.created_at,
      subjectName: subj?.name ?? "Unknown",
      subjectSlug: subj?.slug ?? "unknown",
      assignmentNumber: row.assignments?.number ?? 0,
      batchName: row.batches?.name ?? "—",
    };
  });
}

export interface DownloadLogEntry {
  id: string;
  createdAt: string;
  downloaderRoll: string;
  batchName: string;
  subjectName: string;
  assignmentNumber: number;
  templateId: string;
}

export interface DownloadFilters {
  subjectSlug?: string;
  batchName?: string;
  roll?: string;
  limit?: number;
}

/**
 * Downloads log with optional filters. Roll numbers are personal data — this is
 * only ever called behind requireAdmin(). Joins go through the template to reach
 * subject/assignment. Default limit 500 to bound the response.
 */
export async function listDownloads(
  supabase: DB,
  filters: DownloadFilters = {}
): Promise<DownloadLogEntry[]> {
  const limit = Math.min(filters.limit ?? 500, 5000);

  let query = supabase
    .from("downloads_log")
    .select(
      `id, created_at, downloader_roll, template_id,
       batches(name),
       templates(assignments(number, subjects(slug, name)))`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.roll) query = query.ilike("downloader_roll", `%${filters.roll}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows: DownloadLogEntry[] = (data || []).map((raw) => {
    const row = raw as unknown as {
      id: string;
      created_at: string;
      downloader_roll: string;
      template_id: string;
      batches: { name: string } | null;
      templates: {
        assignments: { number: number; subjects: { slug: string; name: string } | null } | null;
      } | null;
    };
    const assignment = row.templates?.assignments ?? null;
    const subj = assignment?.subjects ?? null;
    return {
      id: row.id,
      createdAt: row.created_at,
      downloaderRoll: row.downloader_roll,
      batchName: row.batches?.name ?? "—",
      subjectName: subj?.name ?? "Unknown",
      subjectSlug: subj?.slug ?? "unknown",
      assignmentNumber: assignment?.number ?? 0,
      templateId: row.template_id,
    } as DownloadLogEntry & { subjectSlug: string };
  });

  if (filters.subjectSlug)
    rows = rows.filter(
      (r) => (r as DownloadLogEntry & { subjectSlug: string }).subjectSlug === filters.subjectSlug
    );
  if (filters.batchName) rows = rows.filter((r) => r.batchName === filters.batchName);

  return rows;
}

/** Serialize download rows to CSV (admin export). Values are quote-escaped. */
export function downloadsToCsv(rows: DownloadLogEntry[]): string {
  const header = ["timestamp", "roll_number", "subject", "assignment", "batch", "template_id"];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        esc(r.createdAt),
        esc(r.downloaderRoll),
        esc(r.subjectName),
        esc(r.assignmentNumber),
        esc(r.batchName),
        esc(r.templateId),
      ].join(",")
    );
  }
  return lines.join("\n");
}
