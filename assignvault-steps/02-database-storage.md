# STEP 2: Supabase schema, storage buckets, security, seed data

Paste this whole file into Antigravity after Step 1 is approved.

---

## Before you write anything, ask me
- The number of assignments in each of the four subjects
- The batch names (for example P1, P2, P3, P4)
- My Supabase project URL and keys (I will paste them into `.env.local` myself; tell me which variables you need)

## Tasks

### 1. Setup
- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Create `/lib/supabase/server.ts` (service-role client, server-only, never imported by client components) and `/lib/supabase/browser.ts` (anon client, only for admin auth later).
- `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Migrations (`/supabase/migrations/0001_init.sql`)
Tables (uuid primary keys, `created_at timestamptz default now()`):

- `subjects`: id, slug (unique), name, sort_order
- `batches`: id, name (unique), sort_order
- `assignments`: id, subject_id -> subjects, number int, title text null. Unique (subject_id, number).
- `batch_dates`: id, batch_id -> batches, assignment_id -> assignments, date (date). Unique (batch_id, assignment_id).
- `submissions`: id, assignment_id, batch_id, uploader_first, uploader_middle, uploader_surname, uploader_roll, uploader_folder text null, uploader_date (date, null), terminal_output_text text null (only used by the optional Step 7 Part B), raw_file_path text, source_format ('docx' | 'pdf'), status ('received' | 'awaiting_conversion' | 'converted' | 'templated' | 'failed'), error_message null, ip_hash text.
- `templates`: id, submission_id -> submissions, assignment_id, batch_id, file_path text null, status ('pending' | 'approved' | 'rejected'), placeholder_counts jsonb default '{}', requires_folder bool default false, block_count int default 0, warnings jsonb default '[]', output_images jsonb default '[]', needs_review bool default true, converted_from_pdf bool default false, report_count int default 0, rejected_reason text null, approved_at timestamptz null.
- `downloads_log`: id, template_id, batch_id, downloader_roll, ip_hash.
- `admin_users`: user_id (references auth.users), created_at.
- `audit_log`: id, actor (uuid null), action text, details jsonb.

Indexes for every foreign key and for (assignment_id, status) on templates.

### 3. Security
- Enable Row Level Security on **every** table.
- No public policies. All app access goes through server routes using the service-role key.
- Policy so an authenticated user listed in `admin_users` can read/write everything (used in Step 9).
- Storage buckets, both **private**: `raw-uploads` and `templates`. A third private bucket `output-assets` will be added in Step 7.
- Storage policies: deny all public access.

### 4. Seed
- Idempotent seed script `/supabase/seed.sql` (safe to run twice): the 4 subjects (slugs `csharp`, `core-java`, `basic-python`, `react-js`), the batches I told you, and assignments 1..N per subject.

### 5. Typed data layer
- Generate DB types (`supabase gen types`) into `/types/database.ts`.
- `/lib/data/catalog.ts` with server functions: `getSubjects()`, `getBatches()`, `getAssignments(subjectSlug)`.
- Route handlers `GET /api/catalog/subjects`, `GET /api/catalog/batches`, `GET /api/catalog/assignments?subject=slug` (cached with sensible revalidation).
- Replace the mock data in the Download and Upload forms with these live endpoints.

## Manual checklist for me
- [ ] Migration runs cleanly on a fresh Supabase project
- [ ] Seed can be run twice without duplicates
- [ ] Both buckets are private (test: a direct URL to a file returns an error)
- [ ] With the anon key only, selecting from any table returns nothing
- [ ] Download and Upload forms now show real subjects, batches and assignment numbers

## Rules
Do not build upload handling. Do not start Step 3. Stop and wait for my approval.
