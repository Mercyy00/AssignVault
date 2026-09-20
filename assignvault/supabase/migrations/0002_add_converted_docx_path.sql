-- Migration: Add converted_docx_path column to submissions table
-- Used by Step 4 (PDF-to-DOCX conversion) to store the path to the converted Word document in raw-uploads

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS converted_docx_path TEXT;

-- Update comments for clarity
COMMENT ON COLUMN submissions.converted_docx_path IS 'Path in raw-uploads bucket to converted .docx file if source_format is pdf';
