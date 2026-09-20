"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { RefreshCw, XCircle } from "lucide-react";

/**
 * Inline one-click actions on the reports queue: set a reported template back to
 * pending (so it re-enters review) or reject it outright with a reason.
 */
export function ReportActions({
  templateId,
  status,
}: {
  templateId: string;
  status: "pending" | "approved" | "rejected";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const call = async (action: string, reason?: string) => {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/templates/${templateId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error || "Action failed.", "error");
        return;
      }
      toast("Updated.", "success");
      router.refresh();
    } catch {
      toast("Network error.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {status !== "pending" && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => call("reset_pending")}
          isLoading={busy === "reset_pending"}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Pending
        </Button>
      )}
      {status !== "rejected" && (
        <Button
          size="sm"
          variant="danger"
          className="gap-1"
          onClick={() => {
            const reason = window.prompt("Rejection reason (required):");
            if (reason && reason.trim()) call("reject", reason.trim());
            else if (reason !== null) toast("A reason is required to reject.", "error");
          }}
          isLoading={busy === "reject"}
        >
          <XCircle className="w-3.5 h-3.5" /> Reject
        </Button>
      )}
    </div>
  );
}
