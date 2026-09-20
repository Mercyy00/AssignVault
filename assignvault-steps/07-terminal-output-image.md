# STEP 7: Terminal output image regeneration

Paste this whole file into Antigravity after Step 6 is approved.

---

## Problem
The output under the source code is usually a screenshot. Text replacement cannot change pixels. Solution: the uploader pastes the output as text, marks which image(s) in the document are the terminal output, and the site renders a fresh terminal-style image containing the downloader's folder name, then swaps it into the document.

## Tasks

### 1. Upload flow changes
- After a docx is templated (Step 5), show the uploader a screen listing every image found (from the Step 5 image inventory) as thumbnails, with checkboxes: "Which of these are terminal output?".
- For each image the uploader marks, show a Textarea "Paste the exact text shown in this screenshot" and a **theme selector** matching what their screenshot looks like: Windows CMD, PowerShell, VS Code dark terminal, Ubuntu terminal, macOS Terminal.
- Save into `templates.output_images` as JSON: `[{ media_path, rel_id, width_emu, height_emu, theme, text_template }]`.
- The `text_template` is the pasted text run through the same detection as Step 5 (folder name, name, roll number, date replaced by placeholders such as `{{FOLDER|case=asis}}`). Show the uploader the converted text so they can confirm.

### 2. Terminal renderer (`/lib/terminal/render.ts`)
- Input: text, theme, target aspect ratio, width in pixels. Output: PNG buffer.
- Use a server-side canvas library that works on Vercel serverless (for example `@napi-rs/canvas`; ask me before installing). Bundle an open-licensed monospace font (for example Cascadia Mono or JetBrains Mono) in `/assets/fonts` and register it explicitly.
- Themes: background and foreground colors, prompt style, font size ratio, title bar (CMD/PowerShell window chrome), window padding, and a blinking-cursor block on the final prompt line.
- Handle long lines (wrap like the real terminal), tabs, ANSI color codes (basic 16 colors), and up to 200 lines.
- Snapshot tests: render a few sample outputs and compare against stored PNGs.

### 3. Fill flow update (`/lib/docx/fill.ts`)
- For each entry in `output_images`, take `text_template`, fill placeholders with the downloader's values, render the PNG, and overwrite the image media file in the docx package (keep the same relationship id and path).
- If the rendered image has a different aspect ratio, update `wp:extent` and `a:ext` (EMU) to keep the original **width** and adjust the **height**.
- Keep the file extension the same as the original media (convert PNG to the needed format if the original is JPEG).
- If a template has no marked output images, leave images unchanged and show the downloader a warning: "This assignment's output screenshot could not be personalized and may show another student's folder name."

### 4. Preview
- Route `POST /api/preview-output` that returns the rendered PNG for the entered folder name, so the /download page can show a live preview of the terminal image before the download.
- Rate limit it (60 per hour per IP hash).

### 5. Tests
Renderer determinism; folder placeholder in the text; wrapped long lines; ANSI colors; a JPEG-based original image; aspect ratio change updating the extent values; and a template with no output images produces the warning.

## Manual checklist for me
- [ ] Upload a real assignment, mark the terminal screenshot, paste its text, pick the theme
- [ ] Generate with a different folder name: the new image looks close to my original screenshot style
- [ ] Image size in Word stays sensible (not stretched or tiny)
- [ ] Preview on /download matches the final image in the docx
- [ ] A template without marked images shows the warning

## Rules
Do not build batch dates or admin. Do not start Step 8. Stop and wait for my approval.
