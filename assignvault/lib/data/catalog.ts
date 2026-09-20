import { createServerClient } from "@/lib/supabase/server";
import { MOCK_SUBJECTS, MOCK_BATCHES } from "@/mocks/catalog";

export interface CatalogSubject {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  description?: string;
  badge?: string;
  color?: string;
}

export interface CatalogBatch {
  id: string;
  name: string;
  sort_order: number;
}

export interface CatalogAssignment {
  id: string;
  number: number;
  title: string | null;
  isAvailable?: boolean;
}

/**
 * Fetch all subjects ordered by sort_order.
 */
export async function getSubjects(): Promise<CatalogSubject[]> {
  const supabase = createServerClient();
  if (!supabase) {
    return MOCK_SUBJECTS.map((s, idx) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      sort_order: idx + 1,
      description: s.description,
      badge: s.badge,
      color: s.color,
    }));
  }

  try {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, slug, name, sort_order")
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return MOCK_SUBJECTS.map((s, idx) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        sort_order: idx + 1,
        description: s.description,
        badge: s.badge,
        color: s.color,
      }));
    }

    return data.map((d) => {
      const mockMeta = MOCK_SUBJECTS.find((m) => m.slug === d.slug);
      return {
        id: d.id,
        slug: d.slug,
        name: d.name,
        sort_order: d.sort_order,
        description: mockMeta?.description,
        badge: mockMeta?.badge,
        color: mockMeta?.color,
      };
    });
  } catch {
    return MOCK_SUBJECTS.map((s, idx) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      sort_order: idx + 1,
      description: s.description,
      badge: s.badge,
      color: s.color,
    }));
  }
}

/**
 * Fetch all batches ordered by sort_order.
 */
export async function getBatches(): Promise<CatalogBatch[]> {
  const supabase = createServerClient();
  if (!supabase) {
    return MOCK_BATCHES.map((b, idx) => ({
      id: b.id,
      name: b.name,
      sort_order: idx + 1,
    }));
  }

  try {
    const { data, error } = await supabase
      .from("batches")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return MOCK_BATCHES.map((b, idx) => ({
        id: b.id,
        name: b.name,
        sort_order: idx + 1,
      }));
    }

    return data;
  } catch {
    return MOCK_BATCHES.map((b, idx) => ({
      id: b.id,
      name: b.name,
      sort_order: idx + 1,
    }));
  }
}

/**
 * Fetch assignments for a subject slug.
 * If availableOnly is true, only returns assignments with approved templates.
 */
export async function getAssignments(
  subjectSlug: string,
  availableOnly: boolean = false
): Promise<CatalogAssignment[]> {
  const supabase = createServerClient();
  if (!supabase) {
    // If no database client, in dev mock return assignments 1..20
    return Array.from({ length: 20 }, (_, i) => ({
      id: `mock-assign-${i + 1}`,
      number: i + 1,
      title: `Assignment ${i + 1}`,
      isAvailable: i === 0, // Mock: only assignment 1 is available
    })).filter((a) => !availableOnly || a.isAvailable);
  }

  try {
    // 1. Get subject id
    const { data: subject, error: subError } = await supabase
      .from("subjects")
      .select("id")
      .eq("slug", subjectSlug)
      .maybeSingle();

    if (subError || !subject) {
      return [];
    }

    // 2. Fetch assignments for this subject
    const { data: assignments, error: assignError } = await supabase
      .from("assignments")
      .select("id, number, title")
      .eq("subject_id", subject.id)
      .order("number", { ascending: true });

    if (assignError || !assignments || assignments.length === 0) {
      return [];
    }

    // 3. Check which assignments have approved templates in the database
    const assignmentIds = assignments.map((a) => a.id);
    const { data: templates } = await supabase
      .from("templates")
      .select("assignment_id")
      .in("assignment_id", assignmentIds)
      .eq("status", "approved");

    const approvedSet = new Set((templates || []).map((t) => t.assignment_id));

    const result: CatalogAssignment[] = assignments.map((a) => ({
      id: a.id,
      number: a.number,
      title: a.title,
      isAvailable: approvedSet.has(a.id),
    }));

    if (availableOnly) {
      return result.filter((a) => a.isAvailable);
    }

    return result;
  } catch (err) {
    console.error("Error fetching assignments:", err);
    return [];
  }
}
