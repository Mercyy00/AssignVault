import mammoth from "mammoth";

/**
 * Render a template .docx to sanitized-ish HTML for the admin review preview,
 * with every `{{PLACEHOLDER}}` wrapped in a highlight span so the reviewer can
 * see exactly where personalization will be injected.
 *
 * mammoth produces a limited HTML subset (p, headings, lists, tables, strong,
 * em, a, img, br) — no script/style — from the docx body. We do not render
 * headers/footers (mammoth ignores them), which is acceptable for a review
 * preview; the placeholder COUNTS (shown separately) cover those locations.
 */

export interface PreviewResult {
  html: string;
  placeholderCount: number;
  mammothMessages: string[];
}

const PLACEHOLDER_RE = /\{\{[^}]*\}\}/g;

/**
 * Wrap placeholder tokens in a highlight span. Runs on mammoth's HTML output.
 * The token text itself is escaped so a malformed placeholder can't inject HTML.
 */
export function highlightPlaceholders(html: string): { html: string; count: number } {
  let count = 0;
  const out = html.replace(PLACEHOLDER_RE, (match) => {
    count++;
    const safe = escapeHtml(match);
    return `<mark class="av-ph" data-placeholder="true">${safe}</mark>`;
  });
  return { html: out, count };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function renderTemplatePreview(buffer: Buffer): Promise<PreviewResult> {
  const result = await mammoth.convertToHtml({ buffer });
  const highlighted = highlightPlaceholders(result.value || "");
  return {
    html: highlighted.html,
    placeholderCount: highlighted.count,
    mammothMessages: (result.messages || []).map((m) => m.message),
  };
}
