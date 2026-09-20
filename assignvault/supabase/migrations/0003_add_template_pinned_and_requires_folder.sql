-- Migration 0003: template moderation extras
--
-- 1. `pinned` — Step 9 "Pin as preferred template". When set, the download
--    selection policy prefers this template for its assignment.
-- 2. `requires_folder` — the upload/templatize flow (Steps 5/7) already writes
--    this column, but it was never added to the schema. Adding it here fixes a
--    latent insert-mismatch and lets the review UI show whether a {{FOLDER}}
--    placeholder is present.

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS requires_folder BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN templates.pinned IS 'Step 9: admin-pinned preferred template for its assignment';
COMMENT ON COLUMN templates.requires_folder IS 'True when the template contains a {{FOLDER}} placeholder (downloader must supply a folder name)';

-- Speed up the "best approved template" selection which now considers pinned.
CREATE INDEX IF NOT EXISTS idx_templates_assignment_pinned
  ON templates(assignment_id, pinned)
  WHERE status = 'approved';

-- 3. Allow the raw upload path to be cleared. Step 9 "Delete raw upload" removes
--    the original file from storage and nulls raw_file_path while keeping the
--    approved template. The column was NOT NULL, so relax it.
ALTER TABLE submissions
  ALTER COLUMN raw_file_path DROP NOT NULL;

COMMENT ON COLUMN submissions.raw_file_path IS 'Path in raw-uploads bucket to the original file; NULL after the raw upload has been purged for privacy';
