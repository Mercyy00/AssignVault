# STEP 3: Upload flow (server side) and raw file storage

Paste this whole file into Antigravity after Step 2 is approved.

---

## Goal
Make the /upload form work end to end: validate on the server, store the raw file privately, and create a submission record. .docx is fully handled in this step. PDFs are stored and marked `awaiting_conversion` (Step 4 handles the conversion).

## Tasks

### 1. API route `POST /api/upload` (multipart/form-data)
Validate everything with zod on the server:
- subject slug, assignment number, batch id (must exist in the DB)
- first name, middle / father's name, surname (2 to 30 chars each), roll number (regex from `/lib/validation.ts`)
- date used in the file (optional ISO date), folder name (optional)
- honeypot field must be empty; otherwise return a fake success and store nothing
- file: max 10 MB; extension .docx or .pdf

### 2. File verification (never trust extension or MIME type)
- **.docx**: must be a valid zip containing `[Content_Types].xml` and `word/document.xml`. Protect against zip bombs: reject if there are more than 500 entries or the total uncompressed size exceeds 50 MB. Ignore symlink entries.
- **.pdf**: must start with the `%PDF` bytes.

### 3. Content cross-checks (.docx only; `/lib/docx/extractText.ts`)
Extract paragraph text by joining runs per paragraph so text split across runs is still found. Normalize whitespace (including non-breaking spaces) and compare case-insensitively.
- **Assignment number check**: find `Assignment No:` followed by a number (for example "Assignment No: 04" or "0" + "1" split across runs). Compare with the selected assignment number. If they differ, reject with: "This file says Assignment 4 but you selected Assignment 1." If the label is missing, continue with a warning.
- **Identity check**: the document must satisfy at least ONE of these, otherwise reject with "We couldn't find your name or roll number in this file. Please check the details you entered.":
  - the three name parts appear together in any order in one paragraph
  - a roll-number label line contains the uploader's roll number
  - all label slots are blank (this is a blank-field file). In that case accept and set a flag `blank_fields = true` on the submission.
- Roll numbers must ONLY be compared inside a roll-number label context, never by searching for the digits anywhere in the text.

### 4. Storage and records
- Store the raw file in the private `raw-uploads` bucket at `{submissionId}/original.{ext}`.
- Insert a `submissions` row. For docx set status `received`; for pdf set `awaiting_conversion`.
- Duplicate handling: if a submission already exists with the same roll number + assignment + batch, keep the older one but record it as superseded in `audit_log` (do not delete).
- Store `ip_hash` (SHA-256 of IP + a server secret), never the raw IP.

### 5. Abuse protection
- Rate limit: at most 5 uploads per IP hash per hour (swappable module; small `rate_limits` table or in-memory fallback for local dev).
- Return 429 with a friendly message when exceeded.

### 6. UX
- Upload progress bar, then a success screen ("Thanks! Your file is in the review queue").
- Field-level server errors displayed next to the right input.
- On PDF upload show: "PDF received. It will be converted before review."

### 7. Tests (vitest), using `/fixtures`
- The anonymized Python fixture uploaded with the right details passes; with a wrong roll number it is rejected.
- The blank-fields React fixture is accepted with `blank_fields = true`.
- Wrong assignment number is rejected (the Python fixture is Assignment 4; the React fixture is Assignment 1).
- A renamed .txt is rejected; a zip without `word/document.xml` is rejected; an oversized file is rejected.
- Honeypot filled, and rate limit exceeded.
- Name split across runs ("Sharma", " ", "Rahul", " ", "Kumar") is found.
- Roll number "1" must not match the digit in `range(1,6)` (label-context rule).

## Manual checklist for me
- [ ] The anonymized Python fixture uploads with First=Rahul, Middle=Kumar, Surname=Sharma, Roll=101, Assignment 4
- [ ] The React fixture uploads with any name, Assignment 1, and is accepted as blank-fields
- [ ] Wrong roll or wrong assignment number shows the friendly error
- [ ] 6 quick uploads trigger the rate limit
- [ ] A PDF upload is stored with status `awaiting_conversion`

## Rules
Do not build conversion or templating. Do not start Step 4. Stop and wait for my approval.
