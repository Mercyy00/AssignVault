"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Download, Search } from "lucide-react";

interface DownloadRow {
  id: string;
  createdAt: string;
  downloaderRoll: string;
  batchName: string;
  subjectName: string;
  assignmentNumber: number;
  templateId: string;
}

export function DownloadsExplorer({
  subjects,
  batches,
  initialRows,
}: {
  subjects: { slug: string; name: string }[];
  batches: string[];
  initialRows: DownloadRow[];
}) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [batch, setBatch] = useState("");
  const [roll, setRoll] = useState("");
  const [rows, setRows] = useState<DownloadRow[]>(initialRows);
  const [loading, setLoading] = useState(false);

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (subject) p.set("subject", subject);
    if (batch) p.set("batch", batch);
    if (roll.trim()) p.set("roll", roll.trim());
    return p.toString();
  }, [subject, batch, roll]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/downloads?${buildQuery()}`);
      if (res.status === 401) {
        toast("Session expired. Sign in again.", "error");
        return;
      }
      if (!res.ok) {
        toast("Failed to load downloads.", "error");
        return;
      }
      const j = await res.json();
      setRows(j.rows || []);
    } catch {
      toast("Network error.", "error");
    } finally {
      setLoading(false);
    }
  }, [buildQuery, toast]);

  const exportCsv = () => {
    const q = buildQuery();
    const a = document.createElement("a");
    a.href = `/api/admin/downloads?${q}${q ? "&" : ""}format=csv`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <Select label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All</option>
            {subjects.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select label="Batch" value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">All</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Input
            label="Roll contains"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
            placeholder="e.g. 21CS"
          />
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" onClick={load} isLoading={loading}>
              <Search className="w-4 h-4" /> Filter
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              {loading ? "Loading…" : "No downloads match these filters."}
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Roll</th>
                  <th className="py-2 pr-3 font-medium">Subject</th>
                  <th className="py-2 pr-3 font-medium">A#</th>
                  <th className="py-2 pr-3 font-medium">Batch</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap text-zinc-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 font-medium">{r.downloaderRoll}</td>
                    <td className="py-2 pr-3">{r.subjectName}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.assignmentNumber}</td>
                    <td className="py-2 pr-3">{r.batchName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 0 && (
            <p className="text-xs text-zinc-400 pt-2">{rows.length} row(s).</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
