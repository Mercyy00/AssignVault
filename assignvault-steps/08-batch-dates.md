# STEP 8: Batch dates (admin table, auto-fill on download)

Paste this whole file into Antigravity after Step 7 is approved.

---

## Context
Each batch has its own date per assignment. These dates are only known at the end of the year, so the system must work without them (custom date on download) and use them automatically once entered.

## Tasks

### 1. Data access
- `/lib/data/batchDates.ts`: `getDate(batchId, assignmentId)`, `setDate(...)`, `bulkSet(...)`, `clear(...)`.
- The admin auth from Step 9 is not built yet. For now, protect the admin endpoints with a temporary shared secret header `ADMIN_TEMP_KEY` (server env) and leave a clear TODO to swap it for real auth in Step 9.

### 2. Admin UI at /admin/dates (functional, styled, mobile-friendly)
- Choose a subject; show a grid: rows = assignments, columns = batches, cells = date pickers.
- Bulk tools: fill a whole batch column with the same date; fill a row; "start date + increment every N days" fill; clear selection.
- CSV export and CSV import (`batch,subject,assignment,date`), with a dry-run summary before applying.
- Dates are stored as ISO `date` values; the display format comes from a constant so it can change later.

### 3. Download flow changes
- On /download, when subject, assignment and batch are chosen, fetch the batch date and show it in the summary card: "Date for your batch: 14/09/2026".
- If no date exists, show: "Your batch's date is not published yet. Pick a custom date or check back later." and require the custom date picker.
- Custom date always overrides the stored date.
- Placeholders keep their own `fmt`. Blank-slot placeholders use the constant `DEFAULT_DATE_FORMAT` (DD/MM/YYYY), so a date such as 2026-09-09 becomes `09/09/2026` like in the sample files.
- `POST /api/generate` uses: custom date, else batch date, else a clear error. Formatting still follows each `{{DATE|fmt=...}}` placeholder.

### 4. Tests
Precedence (custom over stored over error), bulk fill and increment logic, CSV import validation (bad dates, unknown batch names, duplicates), format rendering for each supported `fmt`.

## Manual checklist for me
- [ ] Fill dates for one batch across a subject using the grid and bulk tools
- [ ] Export CSV, edit it, import it back with a dry run first
- [ ] Download for that batch: the date is filled automatically
- [ ] Download for another batch with no dates: prompted for a custom date
- [ ] A custom date overrides the stored one

## Rules
Do not build the full admin panel or auth. Do not start Step 9. Stop and wait for my approval.
