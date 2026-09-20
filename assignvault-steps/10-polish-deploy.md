# STEP 10: Security hardening, privacy, PWA, tests, deployment

Paste this whole file into Antigravity after Step 9 is approved.

---

## Tasks

### 1. Security review (do it and report findings honestly)
- Confirm RLS is enabled on every table and buckets are private; use short-lived signed URLs only when unavoidable.
- Confirm the service-role key is never bundled into client code (search the build output).
- Zip bomb and oversized XML protection in every docx parser path.
- Input length limits everywhere; XML/HTML escaping audit for user-supplied values.
- Security headers (CSP, X-Content-Type-Options, Referrer-Policy, frame protection) in `next.config`.
- Optional bot protection on /upload: Cloudflare Turnstile (ask me before adding).
- Replace any in-memory rate limiters with a persistent store (Upstash Redis or a Supabase table).

### 2. Privacy and legal pages
- Real content for /terms and /about: what data is stored (names, roll numbers, uploaded files), how long, who can see it, how to request deletion.
- A "Responsible use" section that I can edit, reminding students to follow their college's academic integrity rules.
- A contact/takedown email address read from an env var.

### 3. PWA and mobile polish
- Web app manifest, icons (192, 512, maskable), theme color, installable on Android and iOS.
- Service worker caching for the app shell only; never cache generated documents or API responses.
- Skeletons and empty states everywhere; toasts for every action; smooth transitions.
- Test at 360px, 390px, 768px and 1440px.

### 4. Quality
- Accessibility pass (keyboard, labels, contrast in light and dark), Lighthouse targets: Performance 90+, Accessibility 95+, Best Practices 95+.
- Custom 404 and 500 pages.
- SEO basics: titles, descriptions, Open Graph tags.

### 5. Automated testing
- Playwright end-to-end: upload docx -> admin approves -> download personalized file -> open the docx and assert that all details changed.
- Second flow: upload a PDF -> converted -> reviewed -> downloaded.
- GitHub Actions workflow running lint, typecheck, unit tests and the converter's pytest.

### 6. Deployment
- Vercel for the web app; Render or Railway (Docker) for the converter; Supabase production project.
- A complete env-var table for each environment, and a step-by-step deploy guide.
- Health checks and basic monitoring (Vercel Analytics; Sentry if I approve).
- Backup notes for the database and the templates bucket.

### 7. Final docs
- README: architecture diagram (Mermaid), setup, env vars, scripts, how to add a new subject, how to rotate keys, troubleshooting.

## Final checklist for me
- [ ] The full flow works on my phone and on a laptop using the deployed URLs
- [ ] The site installs as an app on my phone
- [ ] Security review report has no unresolved high-severity items
- [ ] E2E tests pass in CI
- [ ] I know how to add the first admin, enter batch dates and approve uploads

## Rules
This is the last step. Give me the final summary, the deployed URLs to test, and a list of anything still risky or unfinished.
