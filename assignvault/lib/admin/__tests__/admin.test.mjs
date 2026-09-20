import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyModeration, approvalBlockers } from "../moderation.ts";
import { computeGaps } from "../gaps.ts";
import { downloadsToCsv } from "../reportsDownloads.ts";
import { highlightPlaceholders } from "../preview.ts";
import { hasSevereWarnings, compareTemplates } from "../../templates/select.ts";

describe("Admin panel logic (Step 9)", () => {
  describe("applyModeration", () => {
    it("approve stamps approved_at and clears review/reason", () => {
      const r = applyModeration({ status: "pending" }, "approve", { now: "2026-09-20T00:00:00Z" });
      assert.equal(r.status, "approved");
      assert.equal(r.approvedAt, "2026-09-20T00:00:00Z");
      assert.equal(r.rejectedReason, null);
      assert.equal(r.needsReview, false);
    });

    it("approve works from rejected (re-approval)", () => {
      const r = applyModeration({ status: "rejected" }, "approve");
      assert.equal(r.status, "approved");
      assert.ok(r.approvedAt);
    });

    it("reject requires a reason and clears approved_at", () => {
      const r = applyModeration({ status: "approved" }, "reject", { reason: "residual name" });
      assert.equal(r.status, "rejected");
      assert.equal(r.approvedAt, null);
      assert.equal(r.rejectedReason, "residual name");
    });

    it("reject throws when reason is blank", () => {
      assert.throws(() => applyModeration({ status: "pending" }, "reject", { reason: "  " }));
      assert.throws(() => applyModeration({ status: "pending" }, "reject"));
    });

    it("reset_pending returns to pending and clears fields", () => {
      const r = applyModeration({ status: "approved" }, "reset_pending");
      assert.equal(r.status, "pending");
      assert.equal(r.approvedAt, null);
      assert.equal(r.rejectedReason, null);
    });

    it("throws on unknown action", () => {
      assert.throws(() => applyModeration({ status: "pending" }, "explode"));
    });
  });

  describe("approvalBlockers", () => {
    it("flags severe (residual leak) risk", () => {
      const b = approvalBlockers({ NAME: { total: 2 } }, true);
      assert.ok(b.some((x) => x.toLowerCase().includes("residual")));
    });
    it("flags zero NAME placeholders", () => {
      const b = approvalBlockers({ ROLL: { total: 1 } }, false);
      assert.ok(b.some((x) => x.includes("NAME")));
    });
    it("no blockers when NAME present and not severe", () => {
      const b = approvalBlockers({ NAME: { total: 3 } }, false);
      assert.equal(b.length, 0);
    });
  });

  describe("computeGaps", () => {
    const assignments = [
      { id: "a1", number: 1, subjectSlug: "os", subjectName: "OS" },
      { id: "a2", number: 2, subjectSlug: "os", subjectName: "OS" },
      { id: "a3", number: 1, subjectSlug: "dbms", subjectName: "DBMS" },
    ];
    it("returns assignments with no approved template, grouped by subject", () => {
      const gaps = computeGaps(assignments, new Set(["a2"]));
      const os = gaps.find((g) => g.subjectSlug === "os");
      const dbms = gaps.find((g) => g.subjectSlug === "dbms");
      assert.deepEqual(os.missing, [1]);
      assert.deepEqual(dbms.missing, [1]);
    });
    it("empty when all approved", () => {
      const gaps = computeGaps(assignments, new Set(["a1", "a2", "a3"]));
      assert.equal(gaps.length, 0);
    });
  });

  describe("downloadsToCsv", () => {
    it("emits header + escaped rows", () => {
      const csv = downloadsToCsv([
        {
          id: "1",
          createdAt: "2026-09-20T10:00:00Z",
          downloaderRoll: "21CS001",
          batchName: "P1",
          subjectName: "Operating, Systems",
          assignmentNumber: 3,
          templateId: "t1",
        },
      ]);
      const lines = csv.split("\n");
      assert.equal(lines[0], "timestamp,roll_number,subject,assignment,batch,template_id");
      // Subject contains a comma -> must be quoted.
      assert.ok(lines[1].includes('"Operating, Systems"'));
      assert.ok(lines[1].includes("21CS001"));
    });
    it("header only for empty input", () => {
      const csv = downloadsToCsv([]);
      assert.equal(csv.split("\n").length, 1);
    });
  });

  describe("highlightPlaceholders", () => {
    it("wraps placeholder tokens and counts them", () => {
      const { html, count } = highlightPlaceholders("Hello {{NAME|case=title}} roll {{ROLL}}");
      assert.equal(count, 2);
      assert.ok(html.includes('<mark class="av-ph"'));
      assert.ok(html.includes("{{NAME|case=title}}"));
    });
    it("escapes angle brackets inside a malformed token", () => {
      const { html } = highlightPlaceholders("{{<script>}}");
      assert.ok(!html.includes("<script>"));
      assert.ok(html.includes("&lt;script&gt;"));
    });
    it("count is zero with no placeholders", () => {
      const { count } = highlightPlaceholders("plain text");
      assert.equal(count, 0);
    });
  });

  describe("compareTemplates prefers pinned", () => {
    const base = {
      id: "x",
      report_count: 0,
      warnings: [],
      approved_at: "2026-09-01T00:00:00Z",
      pinned: false,
    };
    it("a pinned template sorts before an unpinned one even with equal reports", () => {
      const pinned = { ...base, id: "pin", pinned: true, approved_at: "2026-08-01T00:00:00Z" };
      const newer = { ...base, id: "new", pinned: false, approved_at: "2026-09-10T00:00:00Z" };
      const sorted = [newer, pinned].sort(compareTemplates);
      assert.equal(sorted[0].id, "pin");
    });
  });

  describe("hasSevereWarnings", () => {
    it("true for residual-leak strings", () => {
      assert.equal(hasSevereWarnings(['Residual roll number "21CS001" found in header1.xml']), true);
    });
    it("true for TemplateWarning objects", () => {
      assert.equal(hasSevereWarnings([{ message: "Name not detected" }]), true);
    });
    it("false for benign warnings", () => {
      assert.equal(hasSevereWarnings(["Image alt text is empty"]), false);
      assert.equal(hasSevereWarnings([]), false);
      assert.equal(hasSevereWarnings(null), false);
    });
  });
});
