# STEP 9: Admin panel (auth, review queue, moderation, management)

Paste this whole file into Antigravity after Step 8 is approved.

---

## Tasks

### 1. Authentication
- Supabase Auth with email + password for admins only (no public sign-up; disable sign-ups in settings and tell me how).
- Middleware protects everything under `/admin`; the user must exist in `admin_users`. Non-admins get a 403 page.
- Replace the temporary `ADMIN_TEMP_KEY` from Step 8 with this real auth on all admin endpoints.
- Provide a documented one-time script to add the first admin.

### 2. Dashboard `/admin`
Cards: pending templates, needs-review count, reported templates, uploads this week, downloads this week, and a table of assignments with no approved template yet ("gaps"), grouped by subject.

### 3. Review queue `/admin/review`
- List pending templates, flagged `needs_review` first, filterable by subject, assignment, batch, source format.
- Detail page shows: uploader details, warnings from the report, placeholder counts, a **rendered preview** of the template (convert docx to HTML with `mammoth`, ask me before installing) with placeholders highlighted, and any `derived_output` warnings from Step 7 (highlight those output lines and let the admin approve, reject or re-run).
- **Test generate** button: enter sample name/roll/folder/date and download the personalized result to check it in Word.
- Actions: Approve, Reject (with reason), Re-run templating with corrected uploader details, Pin as preferred template for that assignment.
- All actions write to `audit_log`.

### 4. Reports `/admin/reports`
Templates with `report_count > 0`, sorted by count, with one-click "set back to pending" or "reject".

### 5. Catalog management `/admin/catalog`
CRUD for subjects, assignments (number and optional title) and batches, with safe deletes (block deleting anything that has templates unless confirmed).

### 6. Data hygiene and privacy
- Button on a template: **Delete raw upload**, which removes the original file from `raw-uploads` and nulls `raw_file_path` while keeping the approved template.
- Setting for automatic raw-file deletion N days after approval (default 14), implemented as a scheduled job (Vercel cron or Supabase scheduled function).
- Downloads log page with filters and CSV export (roll numbers are personal data, so show only to admins).

### 7. Security
- All admin API routes verify the session server-side.
- CSRF-safe mutations, no admin data in public caches.

### 8. Tests
Auth guard (non-admin blocked), approve/reject state transitions, audit log written, gaps query, raw-file deletion.

## Manual checklist for me
- [ ] I can log in as admin; a normal visitor cannot open /admin
- [ ] I can approve a pending template and it then works on /download
- [ ] Reject with a reason works; re-run templating with corrected details works
- [ ] Test generate produces a correct file
- [ ] The gaps list shows assignments with no template
- [ ] Raw upload deletion removes the original file but the template still works

## Rules
Do not start Step 10. Stop and wait for my approval.
