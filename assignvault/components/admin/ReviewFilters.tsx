"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";

interface Props {
  subjects: { slug: string; name: string }[];
  batches: string[];
  current: {
    status: string;
    subject?: string;
    assignment?: string;
    batch?: string;
    format?: string;
  };
}

/**
 * URL-driven filter bar for the review queue. Each control writes its value into
 * the query string and navigates; the server component re-queries. Keeping state
 * in the URL means filters survive refresh and are shareable.
 */
export function ReviewFilters({ subjects, batches, current }: Props) {
  const router = useRouter();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams();
      // Rebuild from current, then override the one key.
      const base: Record<string, string | undefined> = {
        status: current.status,
        subject: current.subject,
        assignment: current.assignment,
        batch: current.batch,
        format: current.format,
      };
      base[key] = value || undefined;
      for (const [k, v] of Object.entries(base)) {
        if (v) params.set(k, v);
      }
      router.push(`/admin/review?${params.toString()}`);
    },
    [router, current]
  );

  return (
    <Card>
      <CardContent className="py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Select
          label="Status"
          value={current.status}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Select
          label="Subject"
          value={current.subject ?? ""}
          onChange={(e) => setParam("subject", e.target.value)}
        >
          <option value="">All</option>
          {subjects.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input
          label="Assignment #"
          type="number"
          min={1}
          value={current.assignment ?? ""}
          onChange={(e) => setParam("assignment", e.target.value)}
        />
        <Select
          label="Batch"
          value={current.batch ?? ""}
          onChange={(e) => setParam("batch", e.target.value)}
        >
          <option value="">All</option>
          {batches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <Select
          label="Source"
          value={current.format ?? ""}
          onChange={(e) => setParam("format", e.target.value)}
        >
          <option value="">All</option>
          <option value="docx">DOCX</option>
          <option value="pdf">PDF</option>
        </Select>
      </CardContent>
    </Card>
  );
}
