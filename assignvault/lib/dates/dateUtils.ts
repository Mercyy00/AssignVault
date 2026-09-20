/**
 * Pure, dependency-free date helpers for Step 8 (batch dates).
 * These have no Supabase imports so they can be unit-tested directly.
 */

/**
 * The default display format used for blank-slot DATE placeholders and for the
 * admin grid / CSV display. Kept as a constant so it can change in one place.
 * A stored date such as 2026-09-09 renders as 09/09/2026, matching the samples.
 */
export const DEFAULT_DATE_FORMAT = "DD/MM/YYYY";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * True when `s` is a real calendar date in strict ISO `YYYY-MM-DD` form.
 * Rejects impossible dates such as 2026-02-30 or 2026-13-01.
 */
export function isValidIsoDate(s: string): boolean {
  if (typeof s !== "string" || !ISO_DATE_REGEX.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Add `n` days to an ISO date and return the result as ISO `YYYY-MM-DD`.
 * Uses UTC arithmetic so results never shift by a day across timezones.
 */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(
    dt.getUTCDate()
  )}`;
}

/**
 * Build a list of ISO dates for the "start date + every N days" bulk fill.
 * Returns `count` dates: start, start+N, start+2N, ...
 * @throws Error if the start date is invalid or the arguments are out of range.
 */
export function computeIncrementDates(
  startIso: string,
  count: number,
  everyNDays: number
): string[] {
  if (!isValidIsoDate(startIso)) {
    throw new Error(`Invalid start date: "${startIso}"`);
  }
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new Error(`Invalid count: ${count}`);
  }
  if (!Number.isInteger(everyNDays) || everyNDays < 0) {
    throw new Error(`Invalid increment: ${everyNDays}`);
  }
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(addDaysIso(startIso, i * everyNDays));
  }
  return out;
}

export type DateSource = "custom" | "batch" | "none";

export interface ResolvedDate {
  date: string | null;
  source: DateSource;
  error?: string;
}

/**
 * Resolve which date wins on download.
 * Precedence: a valid custom date always overrides the stored batch date;
 * otherwise the stored batch date is used; otherwise there is no date and the
 * caller must show a clear error / prompt for a custom date.
 */
export function resolveDownloadDate(input: {
  customDate?: string | null;
  batchDate?: string | null;
}): ResolvedDate {
  const custom = (input.customDate || "").trim();
  const batch = (input.batchDate || "").trim();

  if (custom) {
    if (!isValidIsoDate(custom)) {
      return {
        date: null,
        source: "none",
        error: `The custom date "${custom}" is not a valid date (expected YYYY-MM-DD).`,
      };
    }
    return { date: custom, source: "custom" };
  }

  if (batch) {
    if (!isValidIsoDate(batch)) {
      return {
        date: null,
        source: "none",
        error: `The stored batch date "${batch}" is not a valid date.`,
      };
    }
    return { date: batch, source: "batch" };
  }

  return {
    date: null,
    source: "none",
    error:
      "Your batch's date is not published yet. Pick a custom date or check back later.",
  };
}

// --------------------------------------------------------------------------
// CSV export / import (format: batch,subject,assignment,date)
// --------------------------------------------------------------------------

export interface BatchDateCsvRow {
  batch: string;
  subject: string;
  assignment: number;
  date: string; // ISO YYYY-MM-DD
}

const CSV_HEADER = "batch,subject,assignment,date";

/** Escape a CSV field, quoting it when it contains a comma, quote or newline. */
function csvField(v: string): string {
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/**
 * Serialize batch date rows to CSV text (with header).
 * Dates are written as ISO so the file round-trips through the importer.
 */
export function rowsToCsv(rows: BatchDateCsvRow[]): string {
  const lines = [CSV_HEADER];
  for (const r of rows) {
    lines.push(
      [
        csvField(r.batch),
        csvField(r.subject),
        String(r.assignment),
        r.date,
      ].join(",")
    );
  }
  return lines.join("\n") + "\n";
}

/** Split one CSV line into fields, honoring simple double-quote quoting. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

export interface ParsedCsvRow {
  line: number;
  batch: string;
  subject: string;
  assignment: number | null;
  date: string;
  valid: boolean;
  error?: string;
  duplicate?: boolean;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
}

/**
 * Parse and validate a batch-dates CSV for a dry-run summary before applying.
 * Validates: known batch names, known subject slugs, assignment in range,
 * valid ISO dates, and flags duplicate (batch,subject,assignment) keys.
 */
export function parseBatchDatesCsv(
  text: string,
  opts: {
    validBatchNames: string[];
    validSubjectSlugs: string[];
    maxAssignment: number;
  }
): CsvParseResult {
  const validBatches = new Set(opts.validBatchNames);
  const validSubjects = new Set(opts.validSubjectSlugs);
  const seen = new Set<string>();

  const rawLines = text.split(/\r?\n/);

  const rows: ParsedCsvRow[] = [];
  let lineNo = 0;
  for (const raw of rawLines) {
    lineNo++;
    const trimmed = raw.trim();
    if (!trimmed) continue; // skip blank lines
    // Skip a header row (first non-empty line matching the header labels)
    if (
      lineNo === 1 &&
      /^batch\s*,\s*subject\s*,\s*assignment\s*,\s*date$/i.test(trimmed)
    ) {
      continue;
    }

    const fields = splitCsvLine(trimmed);
    const batch = (fields[0] || "").trim();
    const subject = (fields[1] || "").trim();
    const assignmentStr = (fields[2] || "").trim();
    const date = (fields[3] || "").trim();

    const errors: string[] = [];
    if (fields.length < 4) {
      errors.push("Expected 4 columns: batch,subject,assignment,date");
    }
    if (!batch) errors.push("Missing batch");
    else if (!validBatches.has(batch)) errors.push(`Unknown batch "${batch}"`);

    if (!subject) errors.push("Missing subject");
    else if (!validSubjects.has(subject))
      errors.push(`Unknown subject "${subject}"`);

    const assignment = Number(assignmentStr);
    let assignmentVal: number | null = null;
    if (!assignmentStr) {
      errors.push("Missing assignment");
    } else if (
      !Number.isInteger(assignment) ||
      assignment < 1 ||
      assignment > opts.maxAssignment
    ) {
      errors.push(
        `Assignment "${assignmentStr}" must be an integer 1..${opts.maxAssignment}`
      );
    } else {
      assignmentVal = assignment;
    }

    if (!date) errors.push("Missing date");
    else if (!isValidIsoDate(date))
      errors.push(`Date "${date}" is not valid ISO (YYYY-MM-DD)`);

    let duplicate = false;
    if (errors.length === 0) {
      const key = `${batch}|${subject}|${assignmentVal}`;
      if (seen.has(key)) {
        duplicate = true;
        errors.push("Duplicate row for this batch/subject/assignment");
      } else {
        seen.add(key);
      }
    }

    rows.push({
      line: lineNo,
      batch,
      subject,
      assignment: assignmentVal,
      date,
      valid: errors.length === 0,
      error: errors.length ? errors.join("; ") : undefined,
      duplicate,
    });
  }

  const valid = rows.filter((r) => r.valid).length;
  const duplicates = rows.filter((r) => r.duplicate).length;
  return {
    rows,
    summary: {
      total: rows.length,
      valid,
      invalid: rows.length - valid,
      duplicates,
    },
  };
}
