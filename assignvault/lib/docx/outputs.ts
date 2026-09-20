import type { UploaderDetails, DetectedMatch } from "./detect.ts";
import type { ParagraphTextModel } from "./paragraphs.ts";
import type { TemplateWarning } from "./report.ts";

export interface OutputRegionState {
  inOutputRegion: boolean;
  inSourceCode: boolean;
  hasNameEcho: boolean;
  echoedTokens: string[];
  requiresFolder: boolean;
}

export function createInitialOutputState(): OutputRegionState {
  return {
    inOutputRegion: false,
    inSourceCode: false,
    hasNameEcho: false,
    echoedTokens: [],
    requiresFolder: false,
  };
}

/**
 * Check if a paragraph text marks the start of a terminal/program output region.
 * e.g. "Output:", "Output:-", "Output -", "Terminal Output:"
 */
export function isOutputRegionStart(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^(?:Terminal\s+)?Output\s*[:-]/i.test(trimmed) ||
    /^(?:Terminal\s+)?Output\s*$/i.test(trimmed) ||
    /(?:^|\b)Output\s*[:-]/i.test(trimmed)
  );
}

/**
 * Check if a paragraph text marks the end of an output region (e.g. next question or student info).
 * e.g. "Roll No:", "Roll Number:", "Program Title:", "Q.1", "Assignment No:"
 */
export function isOutputRegionEnd(text: string): boolean {
  const trimmed = text.trim();
  return (
    /(?:^|\b)Roll\s*(?:No\.?|Number|_No)?\s*[:-]/i.test(trimmed) ||
    /^Program\s+Title\s*[:-]?/i.test(trimmed) ||
    /^Assignment\s+(?:No\.?|Number)\s*[:-]?/i.test(trimmed) ||
    /^Q\.\s*\d+/i.test(trimmed) ||
    /^\d+\.\d+\.?\s*(?:Write|Create|Design|Implement)/i.test(trimmed)
  );
}

/**
 * Check if a paragraph text marks the start of a source code block.
 * e.g. "Source Code:", "Code:", "Program:"
 */
export function isSourceCodeStart(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^(?:Source\s+Code|Program\s+Code|Code)\s*[:-]?/i.test(trimmed) ||
    /(?:^|\b)(?:Source\s+Code|Code)\s*[:-]/i.test(trimmed)
  );
}

/**
 * Escape a string for inclusion in regular expressions.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ProcessOutputResult {
  matches: DetectedMatch[];
  warnings: TemplateWarning[];
  needsReview: boolean;
}

/**
 * Process a paragraph that occurs inside an output region:
 * 1. Echo detection: Find lines where a name token appears after a prompt fragment (e.g. "Enter ...:").
 * 2. Derived-output transforms: Search for reversed, uppercase, or lowercase name tokens.
 * 3. Folder paths: Search for folder path segments in prompt strings (e.g. "C:\Users\jayesh\Desktop>").
 * 4. Non-transformable derived output: Lines following an echo that cannot be auto-transformed.
 */
export function processOutputParagraph(
  model: ParagraphTextModel,
  details: UploaderDetails,
  state: OutputRegionState
): ProcessOutputResult {
  const text = model.normalizedText;
  const trimmed = text.trim();
  const matches: DetectedMatch[] = [];
  const warnings: TemplateWarning[] = [];
  let needsReview = false;

  if (trimmed.length === 0) {
    return { matches, warnings, needsReview };
  }

  // Extract name tokens
  let F = details.firstName?.trim() || "";
  let M = details.middleName?.trim() || "";
  let S = details.surname?.trim() || "";

  if ((!F || !S) && details.fullName) {
    const parts = details.fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
      if (!F) F = parts[0];
      if (!M) M = parts.slice(1, -1).join(" ");
      if (!S) S = parts[parts.length - 1];
    } else if (parts.length === 2) {
      if (!F) F = parts[0];
      if (!S) S = parts[1];
    } else if (parts.length === 1) {
      if (!F) F = parts[0];
    }
  }

  const nameTokens: Array<{ role: string; token: string }> = [];
  if (F) nameTokens.push({ role: "F", token: F });
  if (M) nameTokens.push({ role: "M", token: M });
  if (S) nameTokens.push({ role: "S", token: S });

  // 1. ECHO DETECTION: Prompt-like fragment followed by name token
  const PROMPT_REGEX =
    /(?:enter\b[^:\n\r]*[:\-]|input\b[^:\n\r]*[:\-]|(?:\buser\s*|\bstudent\s*)?name\b[^:\n\r]*[:\-]|prompt\b[^:\n\r]*[:\-]|type\s+in\b[^:\n\r]*[:\-])/i;

  const promptMatch = PROMPT_REGEX.exec(text);
  if (promptMatch) {
    const promptEnd = promptMatch.index + promptMatch[0].length;
    const afterPrompt = text.slice(promptEnd);

    // Look for name tokens in the text after the prompt (case-sensitive first, then case-insensitive)
    let foundEcho = false;

    // Check full name first
    const fullNameStr = details.fullName || [F, M, S].filter(Boolean).join(" ");
    if (fullNameStr && fullNameStr.length >= 3) {
      const fullRegexCase = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(fullNameStr)}(?![a-zA-Z0-9])`);
      const fullRegexIncase = new RegExp(
        `(?<![a-zA-Z0-9])${escapeRegex(fullNameStr)}(?![a-zA-Z0-9])`,
        "i"
      );
      const m = fullRegexCase.exec(afterPrompt) || fullRegexIncase.exec(afterPrompt);
      if (m) {
        const start = promptEnd + m.index;
        const end = start + m[0].length;
        let caseStyle: "asis" | "upper" | "lower" = "asis";
        if (m[0] === m[0].toUpperCase() && fullNameStr !== fullNameStr.toUpperCase()) {
          caseStyle = "upper";
        } else if (m[0] === m[0].toLowerCase() && fullNameStr !== fullNameStr.toLowerCase()) {
          caseStyle = "lower";
        }

        matches.push({
          type: "NAME",
          placeholderText: `{{NAME|order=F-M-L|case=${caseStyle}}}`,
          startIndex: start,
          endIndex: end,
          matchedText: m[0],
        });
        foundEcho = true;
        state.hasNameEcho = true;
        state.echoedTokens.push(m[0]);
      }
    }

    if (!foundEcho) {
      for (const { role, token } of nameTokens) {
        if (!token || token.length < 2) continue;

        // Case-sensitive first
        let tokenRegex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(token)}(?![a-zA-Z0-9])`);
        let m = tokenRegex.exec(afterPrompt);

        // Then case-insensitive
        if (!m) {
          tokenRegex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(token)}(?![a-zA-Z0-9])`, "i");
          m = tokenRegex.exec(afterPrompt);
        }

        if (m) {
          const start = promptEnd + m.index;
          const end = start + m[0].length;
          let caseStyle: "asis" | "upper" | "lower" = "asis";
          if (m[0] === m[0].toUpperCase() && token !== token.toUpperCase()) {
            caseStyle = "upper";
          } else if (m[0] === m[0].toLowerCase() && token !== token.toLowerCase()) {
            caseStyle = "lower";
          }

          matches.push({
            type: "NAME",
            placeholderText: `{{NAME|order=${role}|case=${caseStyle}}}`,
            startIndex: start,
            endIndex: end,
            matchedText: m[0],
          });
          foundEcho = true;
          state.hasNameEcho = true;
          state.echoedTokens.push(token);
          break;
        }
      }
    }
  }

  // 2. FOLDER PATHS IN TEXT OUTPUT (e.g. C:\Users\jayesh\Desktop> or D:\jayesh\java>)
  const cleanFolder = details.folderName?.trim() || "";
  if (cleanFolder.length > 0) {
    // Delimited by path separators (\, /) or prompt characters (: > @)
    const folderRegex = new RegExp(
      `(?<=[\\\\/:@\\s]|^)(${escapeRegex(cleanFolder)})(?=[\\\\/:>@\\s]|$)`,
      "gi"
    );
    let fm: RegExpExecArray | null;
    while ((fm = folderRegex.exec(text)) !== null) {
      const start = fm.index;
      const end = start + fm[0].length;
      if (!matches.some((existing) => start < existing.endIndex && end > existing.startIndex)) {
        const matchedStr = fm[0];
        let caseStyle: "asis" | "lower" | "upper" = "asis";
        if (matchedStr === matchedStr.toLowerCase() && cleanFolder !== cleanFolder.toLowerCase()) {
          caseStyle = "lower";
        } else if (
          matchedStr === matchedStr.toUpperCase() &&
          cleanFolder !== cleanFolder.toUpperCase()
        ) {
          caseStyle = "upper";
        } else if (matchedStr === matchedStr.toLowerCase()) {
          caseStyle = cleanFolder === cleanFolder.toLowerCase() ? "asis" : "lower";
        }

        matches.push({
          type: "FOLDER",
          placeholderText: `{{FOLDER|case=${caseStyle}}}`,
          startIndex: start,
          endIndex: end,
          matchedText: matchedStr,
        });
        state.requiresFolder = true;
      }
    }
  }

  // 3. DERIVED-OUTPUT TRANSFORMS
  // Search for reversed name tokens (e.g. "Rahul" -> "luhaR")
  for (const { role, token } of nameTokens) {
    if (token.length >= 3) {
      const reversedToken = token.split("").reverse().join("");
      // Case-sensitive match against reversed value
      const revRegex = new RegExp(
        `(?<![a-zA-Z0-9])${escapeRegex(reversedToken)}(?![a-zA-Z0-9])`,
        "g"
      );
      let m: RegExpExecArray | null;
      while ((m = revRegex.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        if (!matches.some((existing) => start < existing.endIndex && end > existing.startIndex)) {
          matches.push({
            type: "NAME",
            placeholderText: `{{NAME|order=${role}|case=asis|transform=reverse}}`,
            startIndex: start,
            endIndex: end,
            matchedText: m[0],
          });
        }
      }

      // UPPERCASE / lowercase transforms if distinct from original token
      // Ensure we do not match inside path segments (e.g. \jayesh\)
      const charBefore = (start: number) => (start > 0 ? text[start - 1] : "");
      const charAfter = (end: number) => (end < text.length ? text[end] : "");
      const isPath = (start: number, end: number) =>
        ["\\", "/", ":"].includes(charBefore(start)) || ["\\", "/", ":", ">"].includes(charAfter(end));

      const upperToken = token.toUpperCase();
      const lowerToken = token.toLowerCase();

      if (token !== upperToken) {
        const upperRegex = new RegExp(
          `(?<![a-zA-Z0-9])${escapeRegex(upperToken)}(?![a-zA-Z0-9])`,
          "g"
        );
        while ((m = upperRegex.exec(text)) !== null) {
          const start = m.index;
          const end = start + m[0].length;
          if (
            !isPath(start, end) &&
            !matches.some((existing) => start < existing.endIndex && end > existing.startIndex)
          ) {
            matches.push({
              type: "NAME",
              placeholderText: `{{NAME|order=${role}|case=upper}}`,
              startIndex: start,
              endIndex: end,
              matchedText: m[0],
            });
          }
        }
      }

      if (token !== lowerToken) {
        const lowerRegex = new RegExp(
          `(?<![a-zA-Z0-9])${escapeRegex(lowerToken)}(?![a-zA-Z0-9])`,
          "g"
        );
        while ((m = lowerRegex.exec(text)) !== null) {
          const start = m.index;
          const end = start + m[0].length;
          if (
            !isPath(start, end) &&
            !matches.some((existing) => start < existing.endIndex && end > existing.startIndex)
          ) {
            matches.push({
              type: "NAME",
              placeholderText: `{{NAME|order=${role}|case=lower}}`,
              startIndex: start,
              endIndex: end,
              matchedText: m[0],
            });
          }
        }
      }
    }
  }

  // 4. NON-TRANSFORMABLE DERIVED OUTPUT CHECK
  // If an echo was previously seen in this output block, and this line follows the echo,
  // check if it appears to be a computed property derived from the name that cannot be transformed.
  if (state.hasNameEcho && matches.length === 0) {
    // Skip if it's the Output label itself
    if (!isOutputRegionStart(text)) {
      // Check if line indicates derived output (length, vowel count, character count, etc.)
      const DERIVED_INDICATORS =
        /(?:length|len\b|vowel|consonant|character|char\b|count|palindrome|size|digit|frequency)/i;
      const isDerivedLine =
        DERIVED_INDICATORS.test(text) ||
        /\b(?:is|are|=)\s*\d+/i.test(text);

      if (isDerivedLine) {
        const excerpt = trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
        warnings.push({
          type: "derived_output",
          message: "Output depends on the entered name: please review",
          excerpt,
        });
        needsReview = true;
      }
    }
  }

  // Sort matches ascending by start index
  matches.sort((a, b) => a.startIndex - b.startIndex);

  return { matches, warnings, needsReview };
}
