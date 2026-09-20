"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Pin,
  PinOff,
  FlaskConical,
  AlertTriangle,
} from "lucide-react";

interface UploaderDetails {
  fullName: string;
  rollNumber: string;
  batch: string;
  folderName: string;
  fileDate: string;
}

interface Props {
  templateId: string;
  status: "pending" | "approved" | "rejected";
  pinned: boolean;
  leakRisk: boolean;
  blockers: string[];
  uploader: UploaderDetails;
}

export function TemplateActions({
  templateId,
  status,
  pinned,
  leakRisk,
  blockers,
  uploader,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [showRerun, setShowRerun] = useState(false);
  const [showTest, setShowTest] = useState(false);

  // Re-run form (prefilled with the stored uploader details so the admin can
  // correct a mis-detected name variant).
  const [rrName, setRrName] = useState(uploader.fullName);
  const [rrRoll, setRrRoll] = useState(uploader.rollNumber);
  const [rrBatch, setRrBatch] = useState(uploader.batch);
  const [rrFolder, setRrFolder] = useState(uploader.folderName);
  const [rrDate, setRrDate] = useState(uploader.fileDate);

  // Test-generate form (sample downloader).
  const [tFirst, setTFirst] = useState("Sample");
  const [tSurname, setTSurname] = useState("Student");
  const [tRoll, setTRoll] = useState("TEST001");
  const [tBatch, setTBatch] = useState(uploader.batch);
  const [tFolder, setTFolder] = useState("assign");
  const [tDate, setTDate] = useState(uploader.fileDate);

  const moderate = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/templates/${templateId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error || "Action failed.", "error");
        return;
      }
      toast(`Template ${action}${action.endsWith("e") ? "d" : "ed"}.`, "success");
      setShowReject(false);
      router.refresh();
    } catch {
      toast("Network error.", "error");
    } finally {
      setBusy(null);
    }
  };

  const confirmApprove = () => {
    if (leakRisk) {
      const ok = window.confirm(
        "This template has a residual identity-leak risk. Approving it anyway will serve it to downloaders. Are you sure?"
      );
      if (!ok) return;
    }
    moderate("approve");
  };

  const submitReject = () => {
    if (!reason.trim()) {
      toast("A rejection reason is required.", "error");
      return;
    }
    moderate("reject", { reason: reason.trim() });
  };

  const submitRerun = async () => {
    setBusy("rerun");
    try {
      const res = await fetch(`/api/admin/templates/${templateId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: rrName,
          rollNumber: rrRoll,
          batch: rrBatch,
          folderName: rrFolder,
          fileDate: rrDate,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error || "Re-run failed.", "error");
        return;
      }
      toast(
        j.needsReview
          ? "Re-templated — still flagged for review. Check the new scan."
          : "Re-templated cleanly. Review the fresh preview.",
        j.needsReview ? "info" : "success"
      );
      setShowRerun(false);
      router.refresh();
    } catch {
      toast("Network error.", "error");
    } finally {
      setBusy(null);
    }
  };

  const submitTest = async () => {
    setBusy("test");
    try {
      const res = await fetch(`/api/admin/templates/${templateId}/test-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: tFirst,
          surname: tSurname,
          rollNumber: tRoll,
          batch: tBatch,
          folderName: tFolder,
          customDate: tDate,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast(j.error || "Test generate failed.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `test_${tRoll || "sample"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Test file downloaded. Open it in Word to verify.", "success");
    } catch {
      toast("Network error.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <h3 className="font-semibold text-sm">Actions</h3>

        {blockers.length > 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-2.5 space-y-1">
            {blockers.map((b, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300"
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {status !== "approved" && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={confirmApprove}
              isLoading={busy === "approve"}
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </Button>
          )}
          {status !== "rejected" && (
            <Button
              size="sm"
              variant="danger"
              className="gap-1.5"
              onClick={() => setShowReject((s) => !s)}
            >
              <XCircle className="w-4 h-4" /> Reject
            </Button>
          )}
          {status !== "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => moderate("reset_pending")}
              isLoading={busy === "reset_pending"}
            >
              <RefreshCw className="w-4 h-4" /> Set pending
            </Button>
          )}
          {status === "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => moderate(pinned ? "unpin" : "pin")}
              isLoading={busy === "pin" || busy === "unpin"}
            >
              {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              {pinned ? "Unpin" : "Pin as preferred"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowRerun((s) => !s)}
          >
            <RefreshCw className="w-4 h-4" /> Re-run templating
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setShowTest((s) => !s)}
          >
            <FlaskConical className="w-4 h-4" /> Test generate
          </Button>
        </div>

        {showReject && (
          <div className="space-y-2 pt-1">
            <Input
              label="Rejection reason (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. residual name in footer; re-upload needed"
            />
            <Button size="sm" variant="danger" onClick={submitReject} isLoading={busy === "reject"}>
              Confirm reject
            </Button>
          </div>
        )}

        {showRerun && (
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Correct the uploader details and re-run scrubbing. The template returns to pending.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Full name" value={rrName} onChange={(e) => setRrName(e.target.value)} />
              <Input label="Roll" value={rrRoll} onChange={(e) => setRrRoll(e.target.value)} />
              <Input label="Batch" value={rrBatch} onChange={(e) => setRrBatch(e.target.value)} />
              <Input label="Folder" value={rrFolder} onChange={(e) => setRrFolder(e.target.value)} />
              <Input
                label="Doc date"
                type="date"
                value={rrDate}
                onChange={(e) => setRrDate(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={submitRerun} isLoading={busy === "rerun"}>
              Re-run
            </Button>
          </div>
        )}

        {showTest && (
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Fill this template with sample details and download it to open in Word.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input label="First name" value={tFirst} onChange={(e) => setTFirst(e.target.value)} />
              <Input label="Surname" value={tSurname} onChange={(e) => setTSurname(e.target.value)} />
              <Input label="Roll" value={tRoll} onChange={(e) => setTRoll(e.target.value)} />
              <Input label="Batch" value={tBatch} onChange={(e) => setTBatch(e.target.value)} />
              <Input label="Folder" value={tFolder} onChange={(e) => setTFolder(e.target.value)} />
              <Input
                label="Date"
                type="date"
                value={tDate}
                onChange={(e) => setTDate(e.target.value)}
              />
            </div>
            <Button size="sm" variant="secondary" onClick={submitTest} isLoading={busy === "test"}>
              Generate & download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
