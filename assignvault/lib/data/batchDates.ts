import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type DB = SupabaseClient<Database>;

export interface BatchDateEntry {
  batchId: string;
  assignmentId: string;
  date: string; // ISO YYYY-MM-DD
}

/**
 * Get the stored date for a single (batch, assignment) pair.
 * Returns the ISO date string, or null when none is published yet.
 */
export async function getDate(
  supabase: DB,
  batchId: string,
  assignmentId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("batch_dates")
    .select("date")
    .eq("batch_id", batchId)
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (error || !data) return null;
  return data.date;
}

/**
 * Get every published date for the assignments of one subject, as a lookup
 * keyed by `${assignmentId}:${batchId}` -> ISO date. Used by the admin grid.
 */
export async function getDatesForAssignments(
  supabase: DB,
  assignmentIds: string[]
): Promise<Record<string, string>> {
  if (assignmentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("batch_dates")
    .select("batch_id, assignment_id, date")
    .in("assignment_id", assignmentIds);

  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data) {
    map[`${row.assignment_id}:${row.batch_id}`] = row.date;
  }
  return map;
}

/**
 * Set (upsert) a single batch date. Relies on the unique
 * (batch_id, assignment_id) constraint.
 */
export async function setDate(
  supabase: DB,
  batchId: string,
  assignmentId: string,
  dateIso: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("batch_dates")
    .upsert(
      { batch_id: batchId, assignment_id: assignmentId, date: dateIso },
      { onConflict: "batch_id,assignment_id" }
    );
  return { error: error ? error.message : null };
}

/**
 * Upsert many batch dates in one call.
 */
export async function bulkSet(
  supabase: DB,
  entries: BatchDateEntry[]
): Promise<{ error: string | null; count: number }> {
  if (entries.length === 0) return { error: null, count: 0 };
  const rows = entries.map((e) => ({
    batch_id: e.batchId,
    assignment_id: e.assignmentId,
    date: e.date,
  }));
  const { error } = await supabase
    .from("batch_dates")
    .upsert(rows, { onConflict: "batch_id,assignment_id" });
  return { error: error ? error.message : null, count: rows.length };
}

/**
 * Clear (delete) one or more (batch, assignment) date entries.
 */
export async function clear(
  supabase: DB,
  entries: { batchId: string; assignmentId: string }[]
): Promise<{ error: string | null; count: number }> {
  let count = 0;
  for (const e of entries) {
    const { error } = await supabase
      .from("batch_dates")
      .delete()
      .eq("batch_id", e.batchId)
      .eq("assignment_id", e.assignmentId);
    if (error) return { error: error.message, count };
    count++;
  }
  return { error: null, count };
}
