/**
 * Pure "coverage gaps" computation: which assignments have no approved template.
 * Kept free of Supabase so it can be unit-tested with plain arrays.
 */

export interface AssignmentRef {
  id: string;
  number: number;
  subjectSlug: string;
  subjectName: string;
}

export interface GapGroup {
  subjectSlug: string;
  subjectName: string;
  missing: number[]; // assignment numbers with no approved template
}

/**
 * Given all assignments and the set of assignment ids that DO have an approved
 * template, return the missing assignment numbers grouped by subject.
 */
export function computeGaps(
  assignments: AssignmentRef[],
  approvedAssignmentIds: Set<string>
): GapGroup[] {
  const bySubject = new Map<string, GapGroup>();

  for (const a of assignments) {
    if (approvedAssignmentIds.has(a.id)) continue;
    let group = bySubject.get(a.subjectSlug);
    if (!group) {
      group = { subjectSlug: a.subjectSlug, subjectName: a.subjectName, missing: [] };
      bySubject.set(a.subjectSlug, group);
    }
    group.missing.push(a.number);
  }

  // Stable ordering: subjects as first seen, numbers ascending.
  const groups = Array.from(bySubject.values());
  for (const g of groups) g.missing.sort((x, y) => x - y);
  return groups;
}
