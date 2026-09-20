import type { TemplateStatus } from "@/types/database";

export type ModerationAction = "approve" | "reject" | "reset_pending";

export interface ModerationResult {
  status: TemplateStatus;
  approvedAt: string | null;
  rejectedReason: string | null;
  needsReview: boolean;
}

/**
 * Pure state-transition for a template moderation action. No I/O — the caller
 * persists the returned fields. Keeps the allowed transitions in one place and
 * makes them unit-testable.
 *
 * - approve: pending/rejected -> approved, stamps approved_at, clears review flag.
 * - reject: -> rejected with a required reason, clears approved_at.
 * - reset_pending: -> pending (used from the reports queue), clears approved_at.
 */
export function applyModeration(
  current: { status: TemplateStatus },
  action: ModerationAction,
  opts: { reason?: string; now?: string } = {}
): ModerationResult {
  const now = opts.now || new Date().toISOString();

  switch (action) {
    case "approve":
      return {
        status: "approved",
        approvedAt: now,
        rejectedReason: null,
        needsReview: false,
      };
    case "reject": {
      const reason = (opts.reason || "").trim();
      if (!reason) {
        throw new Error("A rejection reason is required.");
      }
      return {
        status: "rejected",
        approvedAt: null,
        rejectedReason: reason,
        needsReview: false,
      };
    }
    case "reset_pending":
      return {
        status: "pending",
        approvedAt: null,
        rejectedReason: null,
        needsReview: false,
      };
    default:
      throw new Error(`Unknown moderation action: ${action}`);
  }
}

/**
 * Whether a template is safe to approve: it must have at least one NAME slot and
 * carry no severe/residual warnings. Used to warn the admin before approval.
 */
export function approvalBlockers(counts: unknown, severe: boolean): string[] {
  const blockers: string[] = [];
  if (severe) {
    blockers.push(
      "This template has severe warnings (possible residual identity leak). Review before approving."
    );
  }
  const c = counts as Record<string, { total?: number }> | null | undefined;
  const nameTotal = c?.NAME?.total ?? 0;
  if (nameTotal === 0) {
    blockers.push("No NAME placeholders were detected — personalization may not work.");
  }
  return blockers;
}
