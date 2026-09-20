"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  Calendar,
  Save,
  Download,
  Upload,
  Eraser,
  ArrowDownToLine,
  Rows3,
  Columns3,
} from "lucide-react";
import { CatalogSubject } from "@/lib/data/catalog";
import {
  computeIncrementDates,
  parseBatchDatesCsv,
  rowsToCsv,
  DEFAULT_DATE_FORMAT,
  type CsvParseResult,
  type BatchDateCsvRow,
} from "@/lib/dates/dateUtils";

interface GridBatch {
  id: string;
  name: string;
}
interface GridAssignment {
  id: string;
  number: number;
}
interface GridData {
  subject: { id: string; slug: string; name: string };
  assignments: GridAssignment[];
  batches: GridBatch[];
  dates: Record<string, string>;
}

export default function AdminDatesPage() {
  const { toast } = useToast();

  const [subjects, setSubjects] = useState<CatalogSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [grid, setGrid] = useState<GridData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable copy of the grid dates keyed by `${assignmentId}:${batchId}`
  const [localDates, setLocalDates] = useState<Record<string, string>>({});

  // Bulk tool inputs
  const [bulkColumn, setBulkColumn] = useState("");
  const [bulkColumnDate, setBulkColumnDate] = useState("");
  const [bulkRow, setBulkRow] = useState("");
  const [bulkRowDate, setBulkRowDate] = useState("");
  const [incColumn, setIncColumn] = useState("");
  const [incStart, setIncStart] = useState("");
  const [incEvery, setIncEvery] = useState("7");

  // CSV import
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null);

  const key = useCallback(
    (assignmentId: string, batchId: string) => `${assignmentId}:${batchId}`,
    []
  );

  // Load subjects on mount
  useEffect(() => {
    fetch("/api/catalog/subjects")
      .then((r) => (r.ok ? r.json() : { subjects: [] }))
      .then((d) => setSubjects(d.subjects || []))
      .catch(() => {});
  }, []);

  const loadGrid = useCallback(
    async (slug: string) => {
      if (!slug) return;
      setIsLoading(true);
      setCsvResult(null);
      try {
        const res = await fetch(`/api/admin/batch-dates?subject=${encodeURIComponent(slug)}`);
        if (res.status === 401) {
          toast("Your admin session has expired. Please sign in again.", "error");
          setGrid(null);
          return;
        }
        if (!res.ok) {
          toast("Failed to load grid.", "error");
          return;
        }
        const data: GridData = await res.json();
        setGrid(data);
        setLocalDates({ ...data.dates });
      } catch {
        toast("Network error loading grid.", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const onSubjectChange = (slug: string) => {
    setSelectedSubject(slug);
    if (slug) loadGrid(slug);
  };

  const setCell = (assignmentId: string, batchId: string, value: string) => {
    setLocalDates((prev) => ({ ...prev, [key(assignmentId, batchId)]: value }));
  };

  const fillColumn = (batchId: string, date: string) => {
    if (!grid || !date) return;
    setLocalDates((prev) => {
      const next = { ...prev };
      for (const a of grid.assignments) next[key(a.id, batchId)] = date;
      return next;
    });
    toast(`Filled batch column with ${date}.`, "success");
  };

  const fillRow = (assignmentId: string, date: string) => {
    if (!grid || !date) return;
    setLocalDates((prev) => {
      const next = { ...prev };
      for (const b of grid.batches) next[key(assignmentId, b.id)] = date;
      return next;
    });
    toast(`Filled assignment row with ${date}.`, "success");
  };

  const incrementFill = (batchId: string, startIso: string, everyN: number) => {
    if (!grid) return;
    try {
      const dates = computeIncrementDates(startIso, grid.assignments.length, everyN);
      setLocalDates((prev) => {
        const next = { ...prev };
        grid.assignments.forEach((a, i) => {
          next[key(a.id, batchId)] = dates[i];
        });
        return next;
      });
      toast(`Applied start + every ${everyN} days to the column.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Invalid increment inputs.", "error");
    }
  };

  const clearColumn = (batchId: string) => {
    if (!grid) return;
    setLocalDates((prev) => {
      const next = { ...prev };
      for (const a of grid.assignments) next[key(a.id, batchId)] = "";
      return next;
    });
  };

  const clearAll = () => {
    if (!grid) return;
    const next: Record<string, string> = {};
    for (const a of grid.assignments) for (const b of grid.batches) next[key(a.id, b.id)] = "";
    setLocalDates(next);
    toast("Cleared all cells in the grid (not yet saved).", "info");
  };

  const save = async () => {
    if (!grid) return;
    const set: { batchId: string; assignmentId: string; date: string }[] = [];
    const clears: { batchId: string; assignmentId: string }[] = [];
    for (const a of grid.assignments) {
      for (const b of grid.batches) {
        const k = key(a.id, b.id);
        const cur = (localDates[k] || "").trim();
        const orig = (grid.dates[k] || "").trim();
        if (cur === orig) continue;
        if (cur) set.push({ batchId: b.id, assignmentId: a.id, date: cur });
        else clears.push({ batchId: b.id, assignmentId: a.id });
      }
    }
    if (set.length === 0 && clears.length === 0) {
      toast("No changes to save.", "info");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/batch-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set, clear: clears }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast(j?.error || "Save failed.", "error");
        return;
      }
      const j = await res.json();
      toast(`Saved: ${j.setCount} set, ${j.clearCount} cleared.`, "success");
      await loadGrid(selectedSubject);
    } catch {
      toast("Network error while saving.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const exportCsv = () => {
    if (!grid) return;
    const rows: BatchDateCsvRow[] = [];
    for (const a of grid.assignments) {
      for (const b of grid.batches) {
        const d = (localDates[key(a.id, b.id)] || "").trim();
        if (d) rows.push({ batch: b.name, subject: grid.subject.slug, assignment: a.number, date: d });
      }
    }
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `batch-dates_${grid.subject.slug}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const runDryRun = () => {
    if (!grid) return;
    const result = parseBatchDatesCsv(csvText, {
      validBatchNames: grid.batches.map((b) => b.name),
      validSubjectSlugs: subjects.map((s) => s.slug),
      maxAssignment: grid.assignments.length,
    });
    setCsvResult(result);
  };

  const applyImport = () => {
    if (!grid || !csvResult) return;
    const byNumber = new Map(grid.assignments.map((a) => [a.number, a.id]));
    const byName = new Map(grid.batches.map((b) => [b.name, b.id]));
    let applied = 0;
    let skippedOtherSubject = 0;
    setLocalDates((prev) => {
      const next = { ...prev };
      for (const row of csvResult.rows) {
        if (!row.valid || row.assignment == null) continue;
        if (row.subject !== grid.subject.slug) {
          skippedOtherSubject++;
          continue;
        }
        const aId = byNumber.get(row.assignment);
        const bId = byName.get(row.batch);
        if (aId && bId) {
          next[key(aId, bId)] = row.date;
          applied++;
        }
      }
      return next;
    });
    toast(
      `Applied ${applied} row(s) to the grid.${
        skippedOtherSubject ? ` ${skippedOtherSubject} skipped (other subject).` : ""
      } Review and Save.`,
      applied > 0 ? "success" : "info"
    );
  };

  const dirtyCount = useMemo(() => {
    if (!grid) return 0;
    let n = 0;
    for (const a of grid.assignments)
      for (const b of grid.batches) {
        const k = key(a.id, b.id);
        if ((localDates[k] || "") !== (grid.dates[k] || "")) n++;
      }
    return n;
  }, [grid, localDates, key]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Batch Dates"
        description={`Set each batch's submission date per assignment. Blank dates fall back to a downloader's custom date. Display format: ${DEFAULT_DATE_FORMAT}.`}
      />

      {/* Subject selector */}
      <Card>
        <CardContent className="py-4">
          <Select
            id="subject"
            label="Subject"
            value={selectedSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
          >
            <option value="" disabled>
              Choose a subject
            </option>
            {subjects.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-zinc-500">Loading grid…</p>}

      {grid && !isLoading && (
        <>
          {/* Bulk tools */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bulk tools</CardTitle>
              <CardDescription className="text-xs">
                Apply changes to the grid, then press Save to persist them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {/* Fill a whole batch column */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[130px]">
                  <Select
                    label="Fill batch column"
                    value={bulkColumn}
                    onChange={(e) => setBulkColumn(e.target.value)}
                  >
                    <option value="">Batch…</option>
                    {grid.batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  type="date"
                  label="with date"
                  value={bulkColumnDate}
                  onChange={(e) => setBulkColumnDate(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!bulkColumn || !bulkColumnDate}
                  onClick={() => fillColumn(bulkColumn, bulkColumnDate)}
                >
                  <Columns3 className="w-4 h-4" /> Fill column
                </Button>
              </div>

              {/* Fill a whole assignment row */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[130px]">
                  <Select
                    label="Fill assignment row"
                    value={bulkRow}
                    onChange={(e) => setBulkRow(e.target.value)}
                  >
                    <option value="">Assignment…</option>
                    {grid.assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        Assignment {a.number}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  type="date"
                  label="with date"
                  value={bulkRowDate}
                  onChange={(e) => setBulkRowDate(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!bulkRow || !bulkRowDate}
                  onClick={() => fillRow(bulkRow, bulkRowDate)}
                >
                  <Rows3 className="w-4 h-4" /> Fill row
                </Button>
              </div>

              {/* Start date + increment every N days */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[130px]">
                  <Select
                    label="Increment column"
                    value={incColumn}
                    onChange={(e) => setIncColumn(e.target.value)}
                  >
                    <option value="">Batch…</option>
                    {grid.batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  type="date"
                  label="start date"
                  value={incStart}
                  onChange={(e) => setIncStart(e.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  label="every N days"
                  className="w-28"
                  value={incEvery}
                  onChange={(e) => setIncEvery(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!incColumn || !incStart}
                  onClick={() => incrementFill(incColumn, incStart, parseInt(incEvery || "0", 10))}
                >
                  <ArrowDownToLine className="w-4 h-4" /> Apply increment
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="ghost" size="sm" className="gap-1.5 text-rose-600" onClick={clearAll}>
                  <Eraser className="w-4 h-4" /> Clear all cells
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Grid */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" /> {grid.subject.name}
                </CardTitle>
                <CardDescription className="text-xs">
                  {dirtyCount > 0 ? `${dirtyCount} unsaved change(s)` : "No unsaved changes"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}>
                  <Download className="w-4 h-4" /> Export CSV
                </Button>
                <Button size="sm" className="gap-1.5" onClick={save} isLoading={isSaving}>
                  <Save className="w-4 h-4" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-1 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-white dark:bg-zinc-900 z-10">
                      Assignment
                    </th>
                    {grid.batches.map((b) => (
                      <th key={b.id} className="p-2 text-center font-semibold">
                        <div className="flex flex-col items-center gap-1">
                          <span>{b.name}</span>
                          <button
                            type="button"
                            onClick={() => clearColumn(b.id)}
                            className="text-[10px] text-rose-500 hover:underline"
                          >
                            clear
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.assignments.map((a) => (
                    <tr key={a.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="p-2 font-medium whitespace-nowrap sticky left-0 bg-white dark:bg-zinc-900">
                        Assignment {a.number}
                      </td>
                      {grid.batches.map((b) => {
                        const k = key(a.id, b.id);
                        const changed = (localDates[k] || "") !== (grid.dates[k] || "");
                        return (
                          <td key={b.id} className="p-1.5">
                            <input
                              type="date"
                              value={localDates[k] || ""}
                              onChange={(e) => setCell(a.id, b.id, e.target.value)}
                              className={`w-full px-2 py-1.5 text-xs rounded-lg border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                changed
                                  ? "border-blue-400 dark:border-blue-600"
                                  : "border-zinc-300 dark:border-zinc-700"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* CSV import */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-500" /> Import CSV
              </CardTitle>
              <CardDescription className="text-xs">
                Columns: <code>batch,subject,assignment,date</code> (date as YYYY-MM-DD). Runs a dry
                run first; rows for the selected subject are applied to the grid — press Save to
                persist.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={5}
                placeholder={"batch,subject,assignment,date\nP1," + grid.subject.slug + ",1,2026-09-14"}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={runDryRun} disabled={!csvText.trim()}>
                  Dry run
                </Button>
                <Button
                  size="sm"
                  onClick={applyImport}
                  disabled={!csvResult || csvResult.summary.valid === 0}
                >
                  Apply {csvResult ? csvResult.summary.valid : 0} valid row(s)
                </Button>
              </div>

              {csvResult && (
                <div className="text-xs space-y-2">
                  <div className="flex flex-wrap gap-3 font-medium">
                    <span>Total: {csvResult.summary.total}</span>
                    <span className="text-emerald-600">Valid: {csvResult.summary.valid}</span>
                    <span className="text-rose-600">Invalid: {csvResult.summary.invalid}</span>
                    <span className="text-amber-600">Duplicates: {csvResult.summary.duplicates}</span>
                  </div>
                  {csvResult.rows.some((r) => !r.valid) && (
                    <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-2 max-h-40 overflow-y-auto">
                      {csvResult.rows
                        .filter((r) => !r.valid)
                        .map((r) => (
                          <div key={r.line} className="text-rose-700 dark:text-rose-300">
                            Line {r.line}: {r.error}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
