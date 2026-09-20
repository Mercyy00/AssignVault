# STEP 4: PDF to DOCX conversion microservice + integration

Paste this whole file into Antigravity after Step 3 is approved.

---

## Context
Students may upload PDFs. The template engine (Step 5) only works on .docx, so every PDF must be converted first. We use the open-source Python library **pdf2docx** (built on PyMuPDF and python-docx). It is no longer actively maintained upstream, so **pin the exact version** in requirements.txt. It cannot run inside Next.js on Vercel, so build it as a separate small service.

## Part A: Converter service (new folder `/converter`, separate from the Next.js app)

1. FastAPI app with:
   - `GET /health` returns `{"status":"ok"}`
   - `POST /convert` accepts multipart upload (field `file`) and returns the converted .docx bytes with the correct content type.
2. Security:
   - Require header `X-API-Key` matching env var `CONVERTER_API_KEY`; otherwise 401.
   - Accept only real PDFs: verify the `%PDF` magic bytes, not just the extension.
   - Max 10 MB and max 30 pages; return 413 / 422 with a clear JSON error.
   - 60 second conversion timeout.
3. Processing:
   - Write to a temp directory, convert with pdf2docx, read the result, and ALWAYS delete temp files (`try/finally`).
   - Before converting, check that the PDF has extractable text using PyMuPDF. If it is a scan with no selectable text, return 422: "This PDF is a scan and has no selectable text. Please upload the original .docx or a text-based PDF."
   - After converting, check the .docx is non-empty and contains text.
4. Structured JSON errors for every failure; never leak stack traces.
5. Dockerfile (python:3.11-slim), pinned requirements.txt, `.env.example`, README with local run instructions (uvicorn) and deploy notes for Render or Railway.
6. pytest tests: valid PDF, non-PDF renamed to .pdf, oversized file, missing API key, scanned PDF.

## Part B: Integrate into Next.js

1. Env vars `CONVERTER_URL` and `CONVERTER_API_KEY` (server only, never exposed to the browser).
2. In the upload route: if the file is a .pdf, send it to the converter. Store BOTH the original PDF and the converted .docx in the private bucket (`{submissionId}/original.pdf` and `{submissionId}/converted.docx`). Update the submission status to `converted`.
3. Migration: add to `submissions` a `converted_docx_path` column. Set `templates.converted_from_pdf = true` and `needs_review = true` for PDF-sourced files later in Step 5.
4. On /upload show a "Converting your PDF..." progress state. On failure show the converter's friendly message and let the user retry. Note in the UI that .docx uploads give better results.
5. After conversion, run the same cross-checks from Step 3 (assignment number, identity, blank-field detection) on the converted text. Reject with a clear message if they fail. Note that converted files often lose the `Roll No:` label spacing, so keep the label dictionary from Step 5 tolerant of extra spaces.
6. If the converter is unreachable or times out, show "Conversion service is busy, please try again" and log the real error server-side. Mark the submission `failed` with `error_message`.

## Manual checklist for me
- [ ] A PDF exported from Word converts, and the resulting .docx opens cleanly in Word
- [ ] A scanned or photographed PDF is rejected with the "scan" message
- [ ] A .jpg renamed to .pdf is rejected
- [ ] With the converter turned off, upload shows the friendly "busy" message
- [ ] Code indentation and tables survive conversion (I will report back if they do not)

## Rules
Do not build the template engine. Do not start Step 5. Keep the converter stateless with no database access. Update the README with a "Converter service" section. Stop and wait for my approval.
