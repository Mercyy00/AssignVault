# STEP 5: Template engine (turn an assignment into a template)

Paste this whole file into Antigravity after Step 4 is approved. This is the hardest step: go slowly and test on the real fixtures.

---

## Goal
Take a submission's .docx (original, or converted from PDF) plus the uploader's details (first, middle, surname, roll, batch, optional date, optional folder) and produce a **template .docx** in which every personal detail slot holds a placeholder from the canonical grammar in the master context. Also produce a detailed report.

Two kinds of files must work:
- **FILLED**: header fields contain the uploader's real values (`Roll No: 101`, `Student Name: Sharma Rahul Kumar`, `Date:09/09/2026`).
- **BLANK**: header fields are empty labels followed only by spaces (`Roll No:`, `Name:      ...      Date:`).

Fixtures: `/fixtures/python_assignment_04_FILLED_anonymized.docx` (filled, 10 blocks, name echoed in the output) and `/fixtures/react_assignment_01_BLANK_FIELDS.docx` (blank, 3 blocks, footer with a page-number field, 17 divider-line drawings).

## Placeholder grammar (do not change it)
See the master context: `NAME` (roles F, M, S; `order`, `case`, optional `transform=reverse`), `ROLL`, `BATCH`, `DATE` (`fmt`), `FOLDER`, and optional `pad=<n>`.

## Tasks

### 1. Module `/lib/docx/`
`unzip.ts`, `paragraphs.ts`, `labels.ts`, `slots.ts`, `detect.ts`, `replace.ts`, `metadata.ts`, `report.ts`, `templatize.ts`, and tests in `__tests__/`.

### 2. XML parts to process
`word/document.xml`, all `word/header*.xml`, `word/footer*.xml`, `word/footnotes.xml`, `word/endnotes.xml`, text boxes and tables if present. Use `@xmldom/xmldom` and preserve every unknown element and namespace exactly. **Never touch** `<w:drawing>`, `mc:AlternateContent`, `<w:pict>`, field codes (`PAGE`, `w:fldChar`, `w:instrText`) or section properties. The React fixture's footer page-number field must survive unchanged.

### 3. Paragraph text model
For every `w:p` build the concatenated text of its runs (`w:t`, `w:tab` as a tab, `w:br` as a newline) with an offset map back to (run, offset). This is how text split across runs ("Sharma"," ","Rahul"," ","Kumar" or "09"+"/09/2026") is found. Normalize non-breaking spaces and repeated spaces for matching only.

### 4. Label dictionary (`labels.ts`, editable constants, case-insensitive, optional trailing colon or dash)
- roll: `Roll No`, `Roll No.`, `Roll Number`, `Roll no`
- name: `Student Name`, `Name`, `Name of Student`
- date: `Date`
- batch: `Batch`, `Batch No`
- assignment number: `Assignment No`, `Assignment Number` (read-only, used for validation)

### 5. Slot detection (label anchored)
A slot is: a label, then everything after it up to the next label in the same paragraph or the end of the paragraph. Handle both cases:
- **Filled slot**: the text after the label is non-blank. Replace the value (trimmed) with the placeholder. Check that it matches the uploader's value; if not, keep the slot but add a warning "slot value differs from entered details".
- **Blank slot**: the text after the label is empty or spaces only. Insert a single space and the placeholder immediately after the label.
- **Same-line labels** (`Name:  <98 spaces> Date:`): record the total original width of the slot (value plus padding) and store it as `pad=<n>` on the placeholder, then remove the padding spaces from the template.
- **Tabs**: labels separated by tabs (`Program Title: <tab x8> Date:09/09/2026`) keep their tabs. Replace only the value.
- Use the placeholder type by label: roll -> `{{ROLL}}`, name -> `{{NAME|order=...|case=...}}` (detect order from the filled text against the uploader's F/M/S; for blank slots default to `S-F-M`, `case=title`), date -> `{{DATE|fmt=...}}` (detect the format from a filled value; for blank slots use the constant `DEFAULT_DATE_FORMAT = 'DD/MM/YYYY'`), batch -> `{{BATCH}}`.

### 6. Free-text detection (outside slots)
- **Full name sequences** (all three parts, any order, whole words, case-insensitive) anywhere in body text: safe to replace.
- **Single name tokens**: replace ONLY (a) inside a name slot, or (b) when the token is echoed as user input after a prompt-like text (`Enter ...:` or `input`), and (c) in reversed form (see Step 7). Never replace a single token found in code lines or elsewhere; instead add a warning listing the paragraph so the admin can decide.
- **Roll number**: NEVER by free text search. Only in roll slots (a roll like `1` or `12` would corrupt `range(1,6)`).
- **Date**: full dates (all supported formats) anywhere are safe. Bare numbers are not dates.
- **Folder name** (only if the uploader gave one): match as a whole path segment (delimited by `\`, `/`, `:`, quotes or whitespace). Record `case`.

### 7. Overlap resolution
Longest match wins; slot matches beat free-text matches; a match is never split across two placeholders; a folder segment equal to a name token counts as FOLDER only in a path-like context.

### 8. Replacement
Put the placeholder text in the run where the match starts, keep that run's formatting, remove the matched characters from later runs (delete runs left empty), set `xml:space="preserve"` where needed. Do not alter anything outside the matched range.

### 9. Metadata scrub
Blank `dc:creator`, `cp:lastModifiedBy` and other identifying fields in `docProps/core.xml` and `docProps/app.xml`; remove comments and tracked-change authors; check `customXml` and `settings.xml`.

### 10. Residual scan
After templating, scan every part case-insensitively for the uploader's name tokens (also reversed), folder name and roll number in slot contexts. Any hit becomes a warning with its location.

### 11. Structure and consistency report (JSON)
- Number of blocks (count of roll labels), and for each placeholder type how many slots were filled. Warn if counts are inconsistent (for example roll placed in 9 of 10 blocks).
- Detected assignment number vs selected number.
- `requires_folder` (true if any FOLDER placeholder exists).
- Warnings such as: name not found; slot value differs; single-token mention left untouched (with paragraph excerpt); residual details found; output line follows a name echo (see Step 7).
- `needs_review = true` for PDF-converted files, blank-field files with any warning, or when the name/roll slot counts are zero.

### 12. Wire-up
After a successful upload (or conversion), run `templatize()`, save to the private `templates` bucket at `{templateId}/template.docx`, create a `templates` row (status `pending`, `placeholder_counts`, `warnings`, `requires_folder`, `block_count`), and update the submission status.

### 13. Developer CLI
`npm run template:test -- fixtures/python_assignment_04_FILLED_anonymized.docx --first Rahul --middle Kumar --surname Sharma --roll 101 --batch P1 --date 2026-09-09` writes `out.docx` and prints the report. Also support `--blank` for blank-field files.

### 14. Tests (vitest), using the fixtures
- Python fixture: 10 `{{ROLL}}` slots, 10 name slots with `order=S-F-M`, one date, no residual "Sharma", "Rahul", "Kumar" or "101" in slot contexts, and the echoed name in `Enter a string:Rahul` becomes a FIRST-name placeholder.
- React fixture: 3 blocks, roll and name and date slots filled with placeholders, `pad` recorded on the `Name: ... Date:` lines, footer field untouched, all 17 drawings preserved byte for byte.
- Unit tests for: split runs; case variants; roll `1` not touching `range(1,6)`; a single-token mention in code is warned and not replaced; the output re-opens with JSZip and every XML part is well-formed; metadata scrubbed.

## Manual checklist for me
- [ ] Run the CLI on both fixtures and open `out.docx` in Word: layout unchanged, placeholders visible in every header block
- [ ] The report shows 10 blocks for the Python file and 3 for the React file
- [ ] Wrong details produce warnings; correct details produce none
- [ ] Author fields are blank in the output

## Rules
Do not build the download flow or any filling logic. Do not start Step 6. Stop and wait for my approval.
