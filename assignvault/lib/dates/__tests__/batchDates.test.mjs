import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DATE_FORMAT,
  isValidIsoDate,
  addDaysIso,
  computeIncrementDates,
  resolveDownloadDate,
  rowsToCsv,
  parseBatchDatesCsv,
} from "../dateUtils.ts";
import { formatDate } from "../../docx/fill.ts";

describe("Batch date utilities (Step 8)", () => {
  describe("isValidIsoDate", () => {
    it("accepts real ISO dates", () => {
      assert.equal(isValidIsoDate("2026-09-09"), true);
      assert.equal(isValidIsoDate("2026-01-01"), true);
      assert.equal(isValidIsoDate("2024-02-29"), true); // leap year
    });
    it("rejects malformed or impossible dates", () => {
      assert.equal(isValidIsoDate("2026-13-01"), false);
      assert.equal(isValidIsoDate("2026-02-30"), false);
      assert.equal(isValidIsoDate("2026-9-9"), false);
      assert.equal(isValidIsoDate("09/09/2026"), false);
      assert.equal(isValidIsoDate(""), false);
      assert.equal(isValidIsoDate("2023-02-29"), false); // non-leap
    });
  });

  describe("addDaysIso", () => {
    it("adds days across month and year boundaries", () => {
      assert.equal(addDaysIso("2026-09-09", 7), "2026-09-16");
      assert.equal(addDaysIso("2026-09-28", 7), "2026-10-05");
      assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
    });
  });

  describe("computeIncrementDates", () => {
    it("produces start + every N days", () => {
      assert.deepEqual(computeIncrementDates("2026-09-01", 3, 7), [
        "2026-09-01",
        "2026-09-08",
        "2026-09-15",
      ]);
    });
    it("supports a zero increment (all same date)", () => {
      assert.deepEqual(computeIncrementDates("2026-09-01", 2, 0), [
        "2026-09-01",
        "2026-09-01",
      ]);
    });
    it("throws on invalid inputs", () => {
      assert.throws(() => computeIncrementDates("bad", 3, 7));
      assert.throws(() => computeIncrementDates("2026-09-01", 0, 7));
      assert.throws(() => computeIncrementDates("2026-09-01", 3, -1));
    });
  });

  describe("resolveDownloadDate precedence (custom > stored > error)", () => {
    it("custom date overrides the stored batch date", () => {
      const r = resolveDownloadDate({ customDate: "2026-10-05", batchDate: "2026-09-14" });
      assert.equal(r.source, "custom");
      assert.equal(r.date, "2026-10-05");
    });
    it("uses the stored batch date when no custom date", () => {
      const r = resolveDownloadDate({ customDate: "", batchDate: "2026-09-14" });
      assert.equal(r.source, "batch");
      assert.equal(r.date, "2026-09-14");
    });
    it("errors clearly when neither is available", () => {
      const r = resolveDownloadDate({ customDate: "", batchDate: null });
      assert.equal(r.source, "none");
      assert.equal(r.date, null);
      assert.match(r.error, /not published yet/i);
    });
    it("rejects an invalid custom date instead of silently using the batch date", () => {
      const r = resolveDownloadDate({ customDate: "2026-99-99", batchDate: "2026-09-14" });
      assert.equal(r.date, null);
      assert.match(r.error, /not a valid date/i);
    });
  });

  describe("formatDate rendering for each supported fmt", () => {
    it("renders every token combination", () => {
      assert.equal(formatDate("2026-09-09", "DD/MM/YYYY"), "09/09/2026");
      assert.equal(formatDate("2026-09-09", DEFAULT_DATE_FORMAT), "09/09/2026");
      assert.equal(formatDate("2026-09-09", "D/M/YY"), "9/9/26");
      assert.equal(formatDate("2026-09-09", "YYYY-MM-DD"), "2026-09-09");
      assert.equal(formatDate("2026-09-09", "D MMMM YYYY"), "9 September 2026");
      assert.equal(formatDate("2026-09-09", "DD MMM YYYY"), "09 Sep 2026");
    });
  });

  describe("CSV export / import", () => {
    const opts = {
      validBatchNames: ["P1", "P2", "P3", "P4"],
      validSubjectSlugs: ["basic-python", "react-js"],
      maxAssignment: 20,
    };

    it("round-trips rows through export then import", () => {
      const csv = rowsToCsv([
        { batch: "P1", subject: "basic-python", assignment: 1, date: "2026-09-14" },
        { batch: "P2", subject: "basic-python", assignment: 2, date: "2026-09-21" },
      ]);
      const parsed = parseBatchDatesCsv(csv, opts);
      assert.equal(parsed.summary.total, 2);
      assert.equal(parsed.summary.valid, 2);
      assert.equal(parsed.summary.invalid, 0);
    });

    it("flags bad dates", () => {
      const parsed = parseBatchDatesCsv("P1,basic-python,1,2026-99-99", opts);
      assert.equal(parsed.summary.valid, 0);
      assert.match(parsed.rows[0].error, /not valid ISO/i);
    });

    it("flags unknown batch names", () => {
      const parsed = parseBatchDatesCsv("PX,basic-python,1,2026-09-14", opts);
      assert.equal(parsed.summary.valid, 0);
      assert.match(parsed.rows[0].error, /Unknown batch/i);
    });

    it("flags unknown subject slugs", () => {
      const parsed = parseBatchDatesCsv("P1,not-a-subject,1,2026-09-14", opts);
      assert.equal(parsed.summary.valid, 0);
      assert.match(parsed.rows[0].error, /Unknown subject/i);
    });

    it("flags out-of-range assignment numbers", () => {
      const parsed = parseBatchDatesCsv("P1,basic-python,99,2026-09-14", opts);
      assert.equal(parsed.summary.valid, 0);
      assert.match(parsed.rows[0].error, /1\.\.20/);
    });

    it("flags duplicate batch/subject/assignment rows", () => {
      const csv = [
        "batch,subject,assignment,date",
        "P1,basic-python,1,2026-09-14",
        "P1,basic-python,1,2026-09-20",
      ].join("\n");
      const parsed = parseBatchDatesCsv(csv, opts);
      assert.equal(parsed.summary.total, 2);
      assert.equal(parsed.summary.valid, 1);
      assert.equal(parsed.summary.duplicates, 1);
    });

    it("skips the header row and blank lines", () => {
      const csv = "batch,subject,assignment,date\n\nP1,basic-python,1,2026-09-14\n";
      const parsed = parseBatchDatesCsv(csv, opts);
      assert.equal(parsed.summary.total, 1);
      assert.equal(parsed.summary.valid, 1);
    });
  });
});
