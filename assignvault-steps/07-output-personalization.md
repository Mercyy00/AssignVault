# STEP 7: Output personalization (typed output first, screenshots only if needed)

Paste this whole file into Antigravity after Step 6 is approved.

---

## What the real files taught us
In the sample assignments the terminal output is **typed text inside the document**, not a screenshot. Personal details still leak into it in two ways:
1. **Echoed input**: `Enter a string:Rahul`.
2. **Derived output**: the next line `Reversed string: luhaR` is computed from that name, so a plain find-and-replace misses it.
Some subjects (for example Java or C#) may also show folder paths such as `D:\jayesh\java>`. Screenshots (images) are not present in any sample, so image regeneration is now optional (Part B).

## Part A: Text output personalization (required)

### 1. Echo detection (extend Step 5, `/lib/docx/outputs.ts`)
- Only look inside "output regions": from an `Output:` or `Output:-` label to the next `Roll No:` label or the end of the document.
- Find lines where a name token (F, M or S, case-sensitive first, then case-insensitive) or the whole name appears after a prompt-like fragment (`Enter ...:`, `Input`, `name`). Replace that token with a NAME placeholder for the matching role (`{{NAME|order=F|case=asis}}`).

### 2. Derived-output transforms
For every name token and folder value, also search the output region for these transformed forms and replace them with the matching placeholder plus `transform`:
- reversed (`luhaR` -> `{{NAME|order=F|case=asis|transform=reverse}}`)
- UPPERCASE, lowercase (use the `case` option instead of a transform)
Reversal is matched case-sensitively against the reversed uploader value.

### 3. Things we cannot auto-transform
If a line follows a name echo and does not match any known transform (for example "length of name is 5", "vowel count is 3"), do not guess. Add a warning to the report: "Output depends on the entered name: please review" with the paragraph excerpt, set `needs_review = true`, and store it in `templates.warnings` with type `derived_output`. The admin panel (Step 9) must highlight these lines.

### 4. Folder paths in text output
If the uploader provided a folder name, detect path segments in output regions (Step 5 rules) and use `{{FOLDER|case=...}}`. Set `requires_folder = true` on the template.

### 5. Tests
- Python fixture: `Enter a string:Rahul` becomes a NAME placeholder with `order=F`, `Reversed string: luhaR` becomes the reverse transform, and generating for "Asha" gives `Enter a string:Asha` and `Reversed string: ahsA`.
- A synthetic case with a folder path in a code prompt (`C:\Users\jayesh\Desktop>`), with `case=asis` and `case=lower`.
- A synthetic "length of name" line produces a `derived_output` warning and no replacement.
- Names never replaced inside source code lines outside output regions.

## Part B: Screenshot regeneration (OPTIONAL: skip unless I say some assignments use screenshots)

If needed later, implement: (1) after templating, list every embedded image (media path, relationship id, size, paragraph index); (2) the uploader marks which are terminal screenshots, pastes the text shown and picks a theme (CMD, PowerShell, VS Code dark, Ubuntu, macOS); (3) `/lib/terminal/render.ts` renders a PNG with a bundled monospace font using a serverless-friendly canvas library (ask me before installing); (4) fill flow overwrites the media file and adjusts `wp:extent` to keep width and adjust height; (5) `POST /api/preview-output` for live preview. Do not build Part B now.

## Manual checklist for me
- [ ] Python fixture: generated file for a different name shows the new name in `Enter a string:` and its reverse on the next line
- [ ] A doc with an unknown derived output line shows a warning and `needs_review`
- [ ] Nothing in source code changed
- [ ] The folder input appears only when a template has folder placeholders

## Rules
Do not build batch dates or admin. Do not start Step 8. Stop and wait for my approval.
