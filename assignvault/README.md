# AssignVault

AssignVault is a responsive web application (mobile-first, desktop-ready) designed for 3rd-year BCS students to upload completed practical assignments and download personalized copies with their own names, roll numbers, batches, submission dates, and terminal output screenshots.

---

## Step 1: Project Setup, Design System & Static Pages (UI Only)

This step establishes the foundational frontend architecture, design system, client-side validation, and mock catalog data.

### Tech Stack
- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 with custom dark mode and accessible touch/contrast targets
- **Forms & Validation**: `react-hook-form` + `zod`
- **Icons**: `lucide-react`
- **Code Quality**: ESLint & Prettier

---

## Step 2: Supabase Schema, Storage, Security & Catalog Data Layer

Introduces persistent database and storage architecture with Supabase:

### Database & Storage Specifications
- **Database Tables**:
  - `subjects`: 4 core subjects (`csharp`, `core-java`, `basic-python`, `react-js`)
  - `batches`: Practical batches (`P1`, `P2`, `P3`, `P4`)
  - `assignments`: 20 assignments per subject (`number: 1..20`)
  - `batch_dates`: Per-batch dates for each assignment
  - `submissions`: Raw upload records with status tracking (`received`, `awaiting_conversion`, `converted`, `templated`, `failed`)
  - `templates`: Processed templates with placeholder counts, warnings, and report metrics
  - `downloads_log`: Track downloader roll numbers and anonymized IP hashes
  - `admin_users`: References `auth.users` for administrative permissions
  - `audit_log`: System action records
- **Security & RLS**:
  - Row Level Security (RLS) enabled on all 8 tables.
  - Public/anonymous access denied; client operations use server-side route handlers via `SUPABASE_SERVICE_ROLE_KEY`.
  - Admin users authenticated via `admin_users` receive full read/write privileges.
- **Private Storage Buckets**:
  - `raw-uploads`: Private bucket for uploaded files.
  - `templates`: Private bucket for processed `.docx` templates.
- **Data Catalog API**:
  - `GET /api/catalog/subjects`: Cached live catalog of subjects.
  - `GET /api/catalog/batches`: Cached live list of batches.
  - `GET /api/catalog/assignments?subject=slug`: Dynamic assignment listing (1 to 20).

### Supabase Migrations & Seeds
- `supabase/migrations/0001_init.sql`: Table definitions, indexes, RLS policies, and private bucket setup.
- `supabase/seed.sql`: Idempotent seed data for subjects, batches, and assignments 1..20.

---

## Step 3: Upload Flow, Server Validation, Raw Storage & Verification

Implements the end-to-end assignment upload lifecycle with server-side validation, authenticity checks, and abuse protection:

### Key Features
- **Route Handler `POST /api/upload`**:
  - Multipart form parsing with server-side Zod validation.
  - Honeypot bot protection (simulated success, no persistence).
  - Rate limiting (max 5 uploads per IP per hour using SHA-256 hashed IPs).
- **Authenticity & Integrity Verification**:
  - Raw magic bytes verification (`%PDF` vs PKZip signature).
  - Archive inspection: requires `[Content_Types].xml` and `word/document.xml`.
  - Zip-bomb defenses: rejects archives exceeding 500 entries or 50 MB uncompressed size.
  - File size cap: 10 MB maximum.
- **Identity Cross-Checking (.docx)**:
  - Run-level plain text extraction preserving split XML tokens across runs.
  - Validates that uploader's roll number or name tokens appear within the assignment text.
- **Private Storage & Supabase Database**:
  - Files saved in private `raw-uploads` bucket (`{submissionId}/original.{ext}`).
  - Records created in `submissions` table: `.docx` files marked `received`, `.pdf` files marked `awaiting_conversion`.
  - Duplicate detection: existing submissions by the same roll number, assignment, and batch are superseded and audited in `audit_log`.
- **Upload UX**:
  - Real-time progress bar, tailored confirmation dialogs, and clear error banners.

---

## Step 4: PDF to DOCX Conversion Microservice + Integration

Provides high-fidelity conversion of uploaded PDF assignments into OpenXML `.docx` files required by the Step 5 template engine.

### Converter Service Architecture (`/converter`)
- **Framework**: Python 3.11 with FastAPI and Uvicorn.
- **Engines**: `pdf2docx` (built on PyMuPDF and python-docx) with pinned dependency versions.
- **Endpoints**:
  - `GET /health`: Health status endpoint.
  - `POST /convert`: Authenticated multipart conversion endpoint (`X-API-Key` required).
- **Security & Inspection**:
  - Magic bytes inspection: rejects non-PDF files.
  - Page & Size caps: rejects files >10 MB or >30 pages.
  - Scanned PDF detection: uses PyMuPDF text extraction to reject scanned / image-only PDFs that lack selectable text.
  - Isolation: isolated temporary directory per request with guaranteed deletion (`try/finally`).
- **Next.js Integration**:
  - Upload pipeline automatically detects PDFs, routes them to the converter, and extracts text for student roll number / name verification.
  - Saves both `original.pdf` and `converted.docx` to the private Supabase `raw-uploads` bucket.
  - Sets `submissions` record status to `converted`.
  - Graceful fallback: returns friendly *"Conversion service is busy, please try again"* if converter is offline or timed out.

---

## Step 5: Template Engine (Transform Completed Assignment into Template)

Turns completed assignment `.docx` files (original or converted from PDF) into reusable templates by replacing student-specific details with canonical placeholders and generating an audit report.

### Canonical Grammar
- `{{NAME|order=...|case=...}}` (e.g. `order=F-M-L|case=title`, `order=L-F|case=upper`, `order=F|case=lower`)
- `{{ROLL}}` (e.g. `24BCS042`, token-bounded with boundary checks so it never matches inside numbers like 2012 or serials)
- `{{BATCH}}` (e.g. `P1` in `Batch: P1`)
- `{{DATE|fmt=...}}` (e.g. `DD/MM/YYYY`, `YYYY-MM-DD`, `D MMMM YYYY`)
- `{{FOLDER|case=...}}` (e.g. `jayesh`, `python-assign`, with path context disambiguation against student name)

### Engine Architecture (`/lib/docx/`)
- `unzip.ts`: ZIP archive loader and serializer using JSZip and `@xmldom/xmldom`, preserving all OpenXML declarations, namespaces, and unknown elements.
- `paragraphs.ts`: Parses paragraph text models, building an exact character-to-DOM offset map (`charMap`) linking each character to its run element and text node offset. Reconstructs text split across runs (e.g., "Jay" + "esh") and normalizes non-breaking spaces for matching.
- `detect.ts`: Discovers occurrences of uploader details using whole-word boundary matching, detects case styles (`asis`, `upper`, `lower`, `title`), resolves name token permutations (F-M-L, L-F-M, L-F, F-L, F, L), applies longest-match-wins overlap resolution, and disambiguates path-adjacent tokens as `FOLDER`.
- `replace.ts`: Replaces matched tokens directly into XML runs in reverse index order to prevent offset drift, preserves run formatting properties (`w:rPr`), manages `xml:space="preserve"`, and prunes empty runs.
- `metadata.ts`: Blanks identifying document metadata in `docProps/core.xml` (`dc:creator`, `cp:lastModifiedBy`) and `docProps/app.xml` (`Company`, `Manager`), removes comments, and scrubs tracked change authors.
- `report.ts`: Aggregates placeholder replacement metrics across locations (`body`, `header`, `footer`, `table`, `textbox`), inventories body images (relationship ID, media path, EMU dimensions, paragraph index), and scans the entire package for residual leaks. Computes `needsReview`.
- `templatize.ts`: Top-level orchestrator taking a `.docx` buffer and uploader details, processing `word/document.xml`, `word/header*.xml`, `word/footer*.xml`, `word/footnotes.xml`, `word/endnotes.xml`, text boxes (`w:txbxContent`), and tables. Returns `{ templateBuffer, report, needsReview }`.

### CLI Tool
```bash
npm run template:test -- path/to/assignment.docx --name "Jayesh Prashant Ghagare" --roll 24BCS042 --batch P1 --folder python-assign --date 2026-09-15 [--out out.docx]
```
Generates `out.docx` and prints an ASCII table report of placeholder counts, warnings, and image inventory.

### Upload Pipeline Integration
- Upload route `POST /api/upload` invokes `templatize()` for all verified `.docx` and converted `.pdf` submissions.
- Saves the resulting template to Supabase private storage `templates/{templateId}/template.docx`.
- Creates a `templates` row with `status: 'pending'`, placeholder counts, warnings, and image inventory.
- Updates the `submissions` record status to `templated` (or `failed` with error message).

---

## Step 6: Template Filling & Download Flow (Personalization)

Completes the full student download workflow: dynamically queries approved templates, personalizes them with downloader details in a strict single pass, and streams the personalized `.docx` file.

### Key Components
- **Template Info API (`GET /api/template-info?subject=&assignment=`)**:
  - Checks if an approved template exists for the chosen assignment.
  - Returns `{ available, templateId, requiresFolder, blockCount, warnings }`.
  - Determines if the terminal folder name input is required.
- **Template Selection Engine (`/lib/templates/select.ts`)**:
  - Selects the best approved template by:
    1. Lowest `report_count`
    2. No severe warnings
    3. Most recent `approved_at`
- **Filling Engine (`/lib/docx/fill.ts`)**:
  - Strict single-pass placeholder expansion (inserted values are never re-scanned).
  - **NAME**: expands roles (`S-F-M`, `L-F-M`, `F-M-L`, etc.), applies casing (`title`, `upper`, `lower`, `asis`), and supports `transform=reverse` after casing (e.g. `Rahul` -> `luhaR`). Cleanly handles omitted middle names without double spaces.
  - **ROLL & BATCH**: exact replacement with whole-word preservation.
  - **DATE**: formats using placeholder tokens (`DD/MM/YYYY`, `YYYY-MM-DD`, `D MMMM YYYY`). Requires valid date or fails safely.
  - **FOLDER**: sanitizes illegal filesystem characters (`\ / : * ? " < > |`) and applies casing.
  - **pad=n**: appends `max(3, n - value.length)` spaces to maintain horizontal tab/label alignment for blank slots (e.g., keeping `Date:` aligned in React assignments).
  - **Drawing & Field Preservation**: Leaves `<w:drawing>` graphics (e.g., 17 horizontal divider shapes) and dynamic footer field codes (`PAGE`) completely intact.
  - **Safety & Injection Defense**: Single-pass processing prevents injection attacks (e.g. names containing `{{ROLL}}` remain literal and are not expanded to roll numbers). Throws safe errors on unexpanded or invalid placeholders.
  - **Reference Watermark**: Optional footer watermark line controlled by `REFERENCE_WATERMARK=true`.
- **Generation Endpoint (`POST /api/generate`)**:
  - Validates request payload using Zod schemas (`firstName`, `middleName`, `surname`, `rollNumber`, `batch`, `customDate`, `folderName`).
  - Rate limited to 20 downloads per hour per IP hash.
  - Streams binary file with sanitized `Content-Disposition: attachment; filename="{Subject}_A{number}_{Roll}.docx"`.
  - Inserts record into `downloads_log`.
- **Problem Reporting API (`POST /api/report`)**:
  - Increments `report_count` on the template.
  - Automatically flags `needs_review = true` when `report_count >= 3`.
  - Audits report events in `audit_log`.
- **Download UI (`/download`)**:
  - 3-part name input (First Name, Middle/Father's Name optional, Surname).
  - Real-time "What will change in your file" card displaying name in college convention (`Surname First Middle`).
  - Conditional terminal folder name input only when required.
  - Dynamic "No file yet" banner linking to `/upload` when no approved template is available.
  - Client-side blob generation with instant browser download trigger.
  - Post-download problem report modal.

---

## Step 7: Output Personalization (Typed Terminal Output)

Extends the template engine to personalize the **typed terminal output** found in the sample assignments (no screenshots are present, so image regeneration — Part B — is intentionally skipped).

### Key Components (`/lib/docx/outputs.ts`)
- **Output regions**: detection is scoped from an `Output:` / `Output:-` label to the next `Roll No:` label (or end of document), so source code is never touched.
- **Echoed input**: prompt-like lines (`Enter a string:Rahul`, `Input name`, ...) that echo a name token are replaced with a matching NAME placeholder (`{{NAME|order=F|case=asis}}`).
- **Derived transforms**: reversed forms (`luhaR` → `{{NAME|order=F|case=asis|transform=reverse}}`) and UPPER/lower case variants are detected against the uploader's value.
- **Un-transformable lines**: lines like "length of name is 5" are **not** guessed. They add a `derived_output` warning, set `needs_review = true`, and are surfaced for admin review.
- **Folder paths in output**: path segments (`C:\Users\jayesh\Desktop>`) become `{{FOLDER|case=...}}` and set `requires_folder = true`.

---

## Step 8: Batch Dates (Admin Grid, Auto-Fill on Download)

Each batch has its own submission date per assignment. These are only known at the end of the year, so the system works without them (custom date on download) and uses them automatically once entered.

### Data Access (`/lib/data/batchDates.ts`)
- `getDate(batchId, assignmentId)`, `getDatesForAssignments(...)`, `setDate(...)` (upsert on the unique `(batch_id, assignment_id)` constraint), `bulkSet(...)`, `clear(...)`.

### Pure Date Utilities (`/lib/dates/dateUtils.ts`, fully unit-tested)
- `DEFAULT_DATE_FORMAT = "DD/MM/YYYY"` — display format for blank-slot dates (so `2026-09-09` → `09/09/2026`, matching the samples).
- `isValidIsoDate`, `addDaysIso`, `computeIncrementDates(start, count, everyN)` for the "start date + every N days" bulk fill.
- `resolveDownloadDate({ customDate, batchDate })` — precedence: **custom overrides stored overrides a clear error**.
- CSV `rowsToCsv` / `parseBatchDatesCsv` — validates unknown batches/subjects, out-of-range assignments, bad ISO dates, and duplicates, returning a dry-run summary.

### Admin UI (`/admin/dates`)
- Subject selector; grid of **rows = assignments, columns = batches, cells = date pickers**.
- Bulk tools: fill a whole batch column, fill an assignment row, "start date + every N days" increment, clear a column / clear all.
- CSV **export** and **import** with a dry-run summary before applying (rows for the selected subject are staged into the grid; Save persists them).
- Protected by a **temporary shared secret** header `x-admin-key` matching the server env `ADMIN_TEMP_KEY` (stored per-browser in localStorage). *TODO: replaced by real Supabase Auth + `admin_users` in Step 9.*

### API Routes
- `GET/POST /api/admin/batch-dates` — admin grid data + upsert/delete (requires `x-admin-key`).
- `GET /api/batch-date?subject=&assignment=&batch=` — public; returns `{ date, display }` for the download page.

### Download Flow Changes (`/download`)
- Once subject, assignment and batch are chosen, the published batch date is fetched and shown: *"Date for your batch: 14/09/2026"*.
- If none is published: *"Your batch's date is not published yet. Pick a custom date or check back later."* — the custom date picker becomes **required**.
- A custom date always **overrides** the stored batch date; `POST /api/generate` resolves custom → batch → clear error, while each `{{DATE|fmt=...}}` placeholder keeps its own format.

---

### Running Locally

```bash
# Navigate to the project directory
cd assignvault

# Install dependencies
npm install

# Start development server on custom port (e.g., 3005)
npm run dev -- -p 3005

# Run automated tests
npm test

# Run linter
npm run lint

# Production build
npm run build
```
Visit **[http://localhost:3005](http://localhost:3005)** in your browser.
