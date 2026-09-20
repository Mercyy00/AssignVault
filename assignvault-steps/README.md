# AssignVault: Antigravity Build Pack

Eleven markdown files (v2): one master context and ten build steps, updated after reading two real assignment files. Sample files are in `fixtures/`. Each file is a complete prompt. Open it, copy everything, paste into Antigravity.

## How to use

1. Paste `00-master-context.md` first. Antigravity should reply "Ready" plus a short summary.
2. Paste `01-...` and let it build. Test it yourself using the checklist at the end of the file.
3. Only when the step passes, paste the next file. Never skip ahead.
4. If something breaks, paste the error and say "fix this, do not start the next step".

## Order

| File | What gets built |
|---|---|
| 00-master-context.md | Project rules, stack, shared placeholder format |
| 01-project-setup-ui.md | Next.js project, design system, all pages (UI only) |
| 02-database-storage.md | Supabase schema, buckets, security rules, seed data |
| 03-upload-flow.md | Upload form to server, validation, raw file storage |
| 04-pdf-converter-service.md | Python PDF to DOCX service and its integration |
| 05-template-engine.md | Label-anchored slots, name detection, template creation (filled and blank files) |
| 06-download-personalization.md | Download form, fill placeholders, return the .docx |
| 07-output-personalization.md | Echoed names and derived output (reversed etc.); screenshots optional |
| 08-batch-dates.md | Per-batch dates, admin grid, auto-fill on download |
| 09-admin-panel.md | Login, review queue, moderation, management |
| 10-polish-deploy.md | Security, privacy, PWA, tests, deployment |

## Fixtures (already included)

- `fixtures/python_assignment_04_FILLED_anonymized.docx`: a filled assignment (details replaced by First=Rahul, Middle=Kumar, Surname=Sharma, Roll=101, Assignment 4, Date 09/09/2026)
- `fixtures/react_assignment_01_BLANK_FIELDS.docx`: a blank-field assignment (Assignment 1)

Do not commit real students' names or roll numbers to Git.

## Still useful to collect before Step 5

Gather 3 or 4 real assignment files (Java, Python, C#, React), in both .docx and PDF form if possible, with the details still in them. Also gather a sample of how your terminal output section looks. Real fixtures make the template engine far more reliable than made-up ones.
