# AssignVault: Master Context (v2, updated after reading real assignment files)

Paste this whole file into Antigravity as your FIRST message.

---

You are helping me build **AssignVault**, a responsive web app (mobile-first, also excellent on laptops and desktops) for college students in a 3rd-year BCS course. There are four practical subjects: **C#, Core Java, Basic Python, React JS**. Each subject has numbered practical assignments (Assignment 1, 2, 3, ...). Students belong to batches (P1, P2, P3, ...).

## Core idea

- A student who has finished an assignment uploads it (.docx, or .pdf which is converted to .docx).
- The system detects the uploader's personal details inside the document and converts the file into a reusable **template** with placeholders.
- Another student picks subject + assignment number + batch, enters their name, roll number (and folder name only if the assignment needs it), and downloads the assignment personalized with their details.

## What real assignment files look like (from two real samples)

Every assignment is a Word .docx with **typed text only** (no screenshots, no tables, no text boxes; the only drawings are horizontal divider lines that must be left untouched). The structure is:

1. Optional first page: assignment number, list of questions, and a `Date:` field.
2. Then one **block per program**, repeated many times (10 blocks in one sample). Each block starts with these header lines:
   - `Roll No:` followed by the value (or **blank** in some files)
   - `Student Name:` or `Name:` followed by the value (or **blank**)
   - `Date:` (sometimes on the same line as Name, separated by a long run of spaces)
   - `Program Title:` or `Program Name:` followed by the question
3. `Source Code:` followed by code.
4. `Output:` (or `Output:-`) followed by typed terminal output.

Important facts learned from the samples:
- Some files have the details **filled in** (an uploaded, completed assignment). Others have the fields **blank** (labels only, followed by empty space). Both must be supported: filled fields are replaced, blank fields are filled.
- Names are written in the college order **Surname, First name, Middle/Father's name** (for example "Sharma Rahul Kumar"). Word splits a name into separate runs at every space ("Sharma", " ", "Rahul", " ", "Kumar"), and dates are split too ("09" + "/09/2026").
- Roll numbers are short (1 to 3 digits). They MUST only be replaced when they follow a roll-number label. Blind replacement would corrupt code such as `range(1,6)`.
- The typed output sometimes echoes user input that is a name (`Enter a string:Rahul`) and the next line shows something derived from it (`Reversed string: luhaR`).
- Layout uses runs of spaces and tabs to push `Date:` to the right of `Name:`.

## What must be personalized

1. **Name**, in every occurrence, in all case variants and orders.
2. **Roll number**, only when it sits in a roll-number slot.
3. **Batch**, where the document has a batch label (optional).
4. **Date**, per batch and per assignment (set by an admin at the end of the year), or a custom date picked by the downloader.
5. **Output text** that echoes the name (with transforms such as reversed) or a folder path (only some assignments).
6. **Document metadata** (author, last modified by) must never leak an identity.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres, Storage (private buckets), Auth (admin only)
- Docx processing: JSZip + @xmldom/xmldom (no heavy office libraries)
- PDF to DOCX: separate Python FastAPI service using pdf2docx (Step 4)
- Optional, only if needed later: server-side canvas for screenshot regeneration (Step 7, Part B)
- Deploy: Vercel (web) + Render or Railway (converter) + Supabase (data)

## Name model (important)

The site never asks for a single "full name". It always collects **three fields**: First name, Middle / Father's name, Surname. Roles: `F` = first, `M` = middle/father's, `S` = surname. This makes detection and filling exact, whatever order a document uses.

## Canonical placeholder grammar (used by Steps 5, 6, 7, 8; never change it)

Placeholders live inside the template .docx, always inside a single run:

- `{{NAME|order=S-F-M|case=title}}`: `order` lists the roles in the order they appear in the document (`S-F-M`, `F-S`, `F`, ...); `case` is `asis`, `upper`, `lower` or `title`. Optional `transform=reverse` (single-role placeholders only).
- `{{ROLL}}`
- `{{BATCH}}`
- `{{DATE|fmt=DD/MM/YYYY}}`: `fmt` tokens: `DD`, `D`, `MM`, `M`, `MMM`, `MMMM`, `YYYY`, `YY`, plus separators.
- `{{FOLDER|case=asis}}`: `case` is `asis`, `upper` or `lower`.
- Any placeholder may carry `pad=<n>`: the number of characters the slot originally occupied (value plus trailing spaces) when another label follows on the same line. At fill time the trailing spaces become `max(3, n - valueLength)` so `Date:` stays aligned.

Values are inserted as plain text. Placeholders are expanded in a single pass and inserted values are never re-scanned.

## Data model (introduced in Step 2)

subjects, batches, assignments, batch_dates, submissions, templates, downloads_log, admin_users, audit_log.

## Working rules (strict)

1. Build **ONE step at a time**. When a step is done, stop, summarize what you built, tell me exactly how to test it, and wait for my approval.
2. Mobile-first. Every page must work at 360px width and at 1440px.
3. Raw uploaded files are never publicly accessible. Only personalized output is downloadable.
4. All validation happens server-side; never trust the client.
5. Escape all user-provided values before inserting into XML or HTML.
6. TypeScript strict mode, small typed modules, short comments, and a README that grows with each step.
7. Ask me before adding any dependency not listed above.
8. Never invent data. If a real value is needed (number of assignments, batch names, etc.), ask me.
9. Every step ends with automated tests where logic is involved, plus a manual test checklist for me.
10. Real sample files are in `/fixtures`. Use them in tests. Never commit real students' names or roll numbers to the repo.

Reply with only the word **"Ready"** and a summary of your understanding in 8 lines or fewer. Do not write any code yet.
