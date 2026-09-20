import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type DB = SupabaseClient<Database>;

export interface Result {
  error: string | null;
}

/**
 * Admin CRUD for the catalog (subjects, assignments, batches). All writes go
 * through the service-role client behind requireAdmin(). "Safe deletes" refuse
 * to remove anything that still has templates unless `force` is passed, so an
 * admin can't silently orphan approved work.
 */

// ---- Subjects ---------------------------------------------------------------

export async function createSubject(
  supabase: DB,
  input: { slug: string; name: string; sortOrder?: number }
): Promise<Result> {
  const { error } = await supabase
    .from("subjects")
    .insert({ slug: input.slug, name: input.name, sort_order: input.sortOrder ?? 0 } as never);
  return { error: error?.message ?? null };
}

export async function updateSubject(
  supabase: DB,
  id: string,
  input: { slug?: string; name?: string; sortOrder?: number }
): Promise<Result> {
  const patch: Record<string, unknown> = {};
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.name !== undefined) patch.name = input.name;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { error } = await supabase.from("subjects").update(patch as never).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteSubject(
  supabase: DB,
  id: string,
  force = false
): Promise<Result> {
  if (!force) {
    // Block if any assignment under this subject has templates.
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id")
      .eq("subject_id", id);
    const assignmentIds = (assignments || []).map((a) => (a as { id: string }).id);
    if (assignmentIds.length > 0) {
      const { count } = await supabase
        .from("templates")
        .select("id", { count: "exact", head: true })
        .in("assignment_id", assignmentIds);
      if ((count ?? 0) > 0) {
        return {
          error: `This subject has ${count} template(s). Confirm to delete anyway (cascades to assignments and templates).`,
        };
      }
    }
  }
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ---- Assignments ------------------------------------------------------------

export async function createAssignment(
  supabase: DB,
  input: { subjectId: string; number: number; title?: string | null }
): Promise<Result> {
  const { error } = await supabase
    .from("assignments")
    .insert({
      subject_id: input.subjectId,
      number: input.number,
      title: input.title ?? null,
    } as never);
  return { error: error?.message ?? null };
}

export async function updateAssignment(
  supabase: DB,
  id: string,
  input: { number?: number; title?: string | null }
): Promise<Result> {
  const patch: Record<string, unknown> = {};
  if (input.number !== undefined) patch.number = input.number;
  if (input.title !== undefined) patch.title = input.title;
  const { error } = await supabase.from("assignments").update(patch as never).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteAssignment(
  supabase: DB,
  id: string,
  force = false
): Promise<Result> {
  if (!force) {
    const { count } = await supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", id);
    if ((count ?? 0) > 0) {
      return {
        error: `This assignment has ${count} template(s). Confirm to delete anyway (cascades to templates).`,
      };
    }
  }
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ---- Batches ----------------------------------------------------------------

export async function createBatch(
  supabase: DB,
  input: { name: string; sortOrder?: number }
): Promise<Result> {
  const { error } = await supabase
    .from("batches")
    .insert({ name: input.name, sort_order: input.sortOrder ?? 0 } as never);
  return { error: error?.message ?? null };
}

export async function updateBatch(
  supabase: DB,
  id: string,
  input: { name?: string; sortOrder?: number }
): Promise<Result> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { error } = await supabase.from("batches").update(patch as never).eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteBatch(
  supabase: DB,
  id: string,
  force = false
): Promise<Result> {
  if (!force) {
    // batches are referenced by submissions, templates, downloads_log, batch_dates.
    const { count } = await supabase
      .from("templates")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", id);
    if ((count ?? 0) > 0) {
      return {
        error: `This batch has ${count} template(s). Deleting is blocked to protect referenced work.`,
      };
    }
  }
  const { error } = await supabase.from("batches").delete().eq("id", id);
  return { error: error?.message ?? null };
}
