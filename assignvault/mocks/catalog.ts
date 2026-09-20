import { Subject, Batch } from "@/types";

export const MOCK_SUBJECTS: Subject[] = [
  {
    id: "sub-1",
    slug: "csharp",
    name: "C#",
    description:
      ".NET framework, object-oriented concepts, Windows forms, and database connectivity.",
    badge: ".NET",
    color: "from-purple-500 to-indigo-600",
    assignments: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: "sub-2",
    slug: "core-java",
    name: "Core Java",
    description: "Multithreading, collections framework, OOP, exception handling, and JDBC.",
    badge: "Java 17",
    color: "from-amber-500 to-orange-600",
    assignments: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  {
    id: "sub-3",
    slug: "basic-python",
    name: "Basic Python",
    description: "Data structures, functions, file handling, modules, and standard libraries.",
    badge: "Python 3",
    color: "from-emerald-500 to-teal-600",
    assignments: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: "sub-4",
    slug: "react-js",
    name: "React JS",
    description: "Components, hooks, state management, routing, and single page applications.",
    badge: "React 19",
    color: "from-cyan-500 to-blue-600",
    assignments: [1, 2, 3, 4, 5, 6, 7, 8],
  },
];

export const MOCK_BATCHES: Batch[] = [
  { id: "batch-p1", name: "P1" },
  { id: "batch-p2", name: "P2" },
  { id: "batch-p3", name: "P3" },
  { id: "batch-p4", name: "P4" },
];

export function getSubjectBySlug(slug: string): Subject | undefined {
  return MOCK_SUBJECTS.find((s) => s.slug === slug);
}

export function getAssignmentsForSubject(slug: string): number[] {
  const subject = getSubjectBySlug(slug);
  return subject ? subject.assignments : [];
}
