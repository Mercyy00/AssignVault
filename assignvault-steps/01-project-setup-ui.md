# STEP 1: Project setup, design system and all pages (UI only)

Paste this whole file into Antigravity after Step 0 is approved.

---

No backend yet. Everything in this step uses mock data.

## Tasks

### 1. Project
- Create a Next.js project (App Router, TypeScript strict, Tailwind CSS) named `assignvault`.
- Folders: `/app`, `/components`, `/components/ui`, `/lib`, `/types`, `/mocks`, `/fixtures`.
- ESLint and Prettier with sensible defaults. Add a `.env.example` (empty for now).
- Copy the two sample files I give you into `/fixtures` (do not modify them).

### 2. Design system
- Clean, modern, friendly. One accent color, rounded-2xl cards, generous spacing.
- Light and dark mode with a toggle (default follows system).
- Body text 16px minimum on mobile; touch targets at least 44px.
- Reusable components in `/components/ui`: Button (variants + loading state), Input, Select, Textarea, Card, Badge, Toast, FileDropzone (UI only), PageHeader, Stepper, EmptyState, Skeleton.

### 3. Layout
- Sticky top navbar: logo, links (Home, Download, Upload), theme toggle. Hamburger menu on mobile.
- Simple footer with links to /about and /terms (placeholder pages).

### 4. Pages (static UI with mock data from `/mocks`)
- **Home**: one-line hero, two large buttons (Download assignment, Upload assignment), four subject cards (C#, Core Java, Basic Python, React JS), and a short "How it works" 3-step section.
- **/download** form fields, in this order: Subject (select), Assignment number (select, depends on subject), Batch (select), **First name, Middle / Father's name, Surname** (three separate inputs), Roll number, Date (optional date picker labelled "Custom date, only if your batch date is not shown"), and a "Generate and download" button.
  - Also include a **Terminal folder name** input, but hidden by default (a prop `showFolder` will turn it on later when the chosen assignment needs it).
  - Under the form, a live "What will change in your file" card showing the name in college order ("Surname First Middle"), roll, batch, date.
- **/upload** form fields: Subject, Assignment number, Batch, First name, Middle / Father's name, Surname, Roll number, **Date used in the file (date picker, optional, because some files have blank date fields)**, a file dropzone (.docx and .pdf, max 10 MB), and a hidden honeypot field. Add helper text: "Upload the completed file exactly as you submitted it."
- **/admin**: placeholder page ("Coming in Step 9").
- **/about** and **/terms**: placeholder text pages.

### 5. Form behavior
- Client-side validation with `zod` + `react-hook-form` (ask me before adding these two).
- Each name field: letters, spaces, dots and hyphens only, 2 to 30 characters.
- Roll number: alphanumeric, 1 to 12 characters. Put the regex in `/lib/validation.ts` as a constant.
- Folder name (when shown): no slashes, colons or illegal filename characters; 1 to 32 characters.
- Inline error messages, disabled submit until valid, loading state on submit (fake a 1.5s delay).
- The assignment number select depends on the chosen subject.

### 6. Quality
- Accessible: labels for every input, visible focus rings, keyboard navigable.
- Looks good at 360px, 768px and 1440px, with no layout shift.

## Manual checklist for me
- [ ] Home, Download and Upload pages look right at phone width and desktop width
- [ ] Theme toggle works and persists on reload
- [ ] Hamburger menu works on phone width
- [ ] Every validation rule blocks bad input with a clear message
- [ ] The three name fields show correctly in the summary card as "Surname First Middle"

## Rules
Do not connect any backend. Do not start Step 2. When done, give me the run commands and this checklist, then stop and wait for my approval.
