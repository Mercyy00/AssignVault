"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2, BookOpen, ListOrdered, Users } from "lucide-react";

interface SubjectRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
}
interface BatchRow {
  id: string;
  name: string;
  sort_order: number;
}
interface AssignmentRow {
  id: string;
  subject_id: string;
  number: number;
  title: string | null;
}

export interface CatalogData {
  subjects: SubjectRow[];
  batches: BatchRow[];
  assignments: AssignmentRow[];
}

type Resource = "subject" | "assignment" | "batch";

export function CatalogManager({ data }: { data: CatalogData }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  // New-subject form
  const [subSlug, setSubSlug] = useState("");
  const [subName, setSubName] = useState("");
  // New-batch form
  const [batchName, setBatchName] = useState("");
  // New-assignment form
  const [asgSubject, setAsgSubject] = useState(data.subjects[0]?.id ?? "");
  const [asgNumber, setAsgNumber] = useState("");
  const [asgTitle, setAsgTitle] = useState("");

  const send = async (
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>
  ): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/catalog", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Safe-delete block — offer force.
        if (window.confirm(`${j.error}\n\nDelete anyway?`)) {
          return send("DELETE", { ...body, force: true });
        }
        return false;
      }
      if (!res.ok) {
        toast(j.error || "Action failed.", "error");
        return false;
      }
      toast("Saved.", "success");
      router.refresh();
      return true;
    } catch {
      toast("Network error.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const del = (resource: Resource, id: string, label: string) => {
    if (!window.confirm(`Delete ${label}?`)) return;
    send("DELETE", { resource, id });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Subjects */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-500" /> Subjects
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {data.subjects.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 text-sm py-1 border-b border-zinc-50 dark:border-zinc-800/50"
              >
                <span className="truncate">
                  {s.name} <span className="text-zinc-400 text-xs">/{s.slug}</span>
                </span>
                <button
                  onClick={() => del("subject", s.id, s.name)}
                  className="text-rose-500 hover:text-rose-600 shrink-0"
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <Input label="Name" value={subName} onChange={(e) => setSubName(e.target.value)} />
            <Input
              label="Slug"
              value={subSlug}
              onChange={(e) => setSubSlug(e.target.value)}
              helperText="lowercase, dashes"
            />
            <Button
              size="sm"
              className="gap-1.5 w-full"
              disabled={busy || !subName || !subSlug}
              onClick={async () => {
                const ok = await send("POST", {
                  resource: "subject",
                  name: subName,
                  slug: subSlug,
                });
                if (ok) {
                  setSubName("");
                  setSubSlug("");
                }
              }}
            >
              <Plus className="w-4 h-4" /> Add subject
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assignments */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <ListOrdered className="w-4 h-4 text-blue-500" /> Assignments
          </h3>
          <Select
            label="Subject"
            value={asgSubject}
            onChange={(e) => setAsgSubject(e.target.value)}
          >
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.assignments
              .filter((a) => a.subject_id === asgSubject)
              .map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 text-sm py-1 border-b border-zinc-50 dark:border-zinc-800/50"
                >
                  <span className="truncate">
                    #{a.number}
                    {a.title ? ` — ${a.title}` : ""}
                  </span>
                  <button
                    onClick={() => del("assignment", a.id, `Assignment ${a.number}`)}
                    className="text-rose-500 hover:text-rose-600 shrink-0"
                    aria-label={`Delete assignment ${a.number}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
          <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <Input
              label="Number"
              type="number"
              min={1}
              value={asgNumber}
              onChange={(e) => setAsgNumber(e.target.value)}
            />
            <Input
              label="Title (optional)"
              value={asgTitle}
              onChange={(e) => setAsgTitle(e.target.value)}
            />
            <Button
              size="sm"
              className="gap-1.5 w-full"
              disabled={busy || !asgSubject || !asgNumber}
              onClick={async () => {
                const ok = await send("POST", {
                  resource: "assignment",
                  subjectId: asgSubject,
                  number: Number(asgNumber),
                  title: asgTitle || null,
                });
                if (ok) {
                  setAsgNumber("");
                  setAsgTitle("");
                }
              }}
            >
              <Plus className="w-4 h-4" /> Add assignment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batches */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-500" /> Batches
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {data.batches.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 text-sm py-1 border-b border-zinc-50 dark:border-zinc-800/50"
              >
                <span className="truncate">{b.name}</span>
                <button
                  onClick={() => del("batch", b.id, b.name)}
                  className="text-rose-500 hover:text-rose-600 shrink-0"
                  aria-label={`Delete ${b.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <Input label="Name" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            <Button
              size="sm"
              className="gap-1.5 w-full"
              disabled={busy || !batchName}
              onClick={async () => {
                const ok = await send("POST", { resource: "batch", name: batchName });
                if (ok) setBatchName("");
              }}
            >
              <Plus className="w-4 h-4" /> Add batch
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
