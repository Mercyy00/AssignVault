export interface UploaderDetails {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  surname?: string;
  rollNumber: string;
  batch: string;
  folderName: string;
  fileDate: string; // YYYY-MM-DD
}

export type PlaceholderType = "NAME" | "ROLL" | "BATCH" | "DATE" | "FOLDER";

export interface DetectedMatch {
  type: PlaceholderType;
  placeholderText: string;
  startIndex: number;
  endIndex: number; // exclusive
  matchedText: string;
}

/**
 * Detect the casing style of a matched string.
 */
export function detectCaseStyle(
  str: string
): "upper" | "lower" | "title" | "asis" {
  const letters = str.replace(/[^a-zA-Z]/g, "");
  if (!letters) return "asis";

  if (str === str.toUpperCase() && str !== str.toLowerCase()) {
    return "upper";
  }
  if (str === str.toLowerCase() && str !== str.toUpperCase()) {
    return "lower";
  }

  const words = str.split(/\s+/).filter(Boolean);
  const isTitle = words.every((w) => {
    const wLetters = w.replace(/[^a-zA-Z]/g, "");
    if (!wLetters) return true;
    return (
      wLetters[0] === wLetters[0].toUpperCase() &&
      wLetters.slice(1) === wLetters.slice(1).toLowerCase()
    );
  });

  return isTitle ? "title" : "asis";
}

/**
 * Escape a string for safe inclusion in a RegExp.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Generate candidate date strings and their corresponding canonical format patterns.
 */
function generateDateCandidates(isoDate: string): Array<{ text: string; fmt: string }> {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return [];

  const yearNum = parseInt(parts[0], 10);
  const monthNum = parseInt(parts[1], 10);
  const dayNum = parseInt(parts[2], 10);

  if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) return [];

  const YYYY = String(yearNum);
  const YY = YYYY.slice(-2);
  const MM = String(monthNum).padStart(2, "0");
  const M = String(monthNum);
  const DD = String(dayNum).padStart(2, "0");
  const D = String(dayNum);

  const monthNamesLong = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthNamesShort = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const MMMM = monthNamesLong[monthNum - 1] || "";
  const MMM = monthNamesShort[monthNum - 1] || "";

  const candidates: Array<{ text: string; fmt: string }> = [
    // Standard formats with separators
    { text: `${DD}/${MM}/${YYYY}`, fmt: "DD/MM/YYYY" },
    { text: `${DD}-${MM}-${YYYY}`, fmt: "DD-MM-YYYY" },
    { text: `${DD}.${MM}.${YYYY}`, fmt: "DD.MM.YYYY" },
    { text: `${D}/${M}/${YYYY}`, fmt: "D/M/YYYY" },
    { text: `${D}-${M}-${YYYY}`, fmt: "D-M-YYYY" },
    { text: `${D}.${M}.${YYYY}`, fmt: "D.M.YYYY" },
    { text: `${YYYY}-${MM}-${DD}`, fmt: "YYYY-MM-DD" },
    { text: `${YYYY}/${MM}/${DD}`, fmt: "YYYY/MM/DD" },
    { text: `${DD}/${MM}/${YY}`, fmt: "DD/MM/YY" },
    { text: `${DD}-${MM}-${YY}`, fmt: "DD-MM-YY" },
    { text: `${DD}.${MM}.${YY}`, fmt: "DD.MM.YY" },
    { text: `${D}/${M}/${YY}`, fmt: "D/M/YY" },

    // Word month formats
    { text: `${D} ${MMMM} ${YYYY}`, fmt: "D MMMM YYYY" },
    { text: `${DD} ${MMMM} ${YYYY}`, fmt: "DD MMMM YYYY" },
    { text: `${MMMM} ${D}, ${YYYY}`, fmt: "MMMM D, YYYY" },
    { text: `${MMMM} ${DD}, ${YYYY}`, fmt: "MMMM DD, YYYY" },
    { text: `${D} ${MMM} ${YYYY}`, fmt: "D MMM YYYY" },
    { text: `${DD} ${MMM} ${YYYY}`, fmt: "DD MMM YYYY" },
    { text: `${MMM} ${D}, ${YYYY}`, fmt: "MMM D, YYYY" },
    { text: `${MMM} ${DD}, ${YYYY}`, fmt: "MMM DD, YYYY" },
  ];

  // Sort longest candidate first so greedy matching finds full dates first
  return candidates.sort((a, b) => b.text.length - a.text.length);
}

/**
 * Check if the match at [startIndex, endIndex] in text is in a path-like context
 * (i.e. immediately preceded or followed by '\', '/', or ':').
 */
function isPathContext(text: string, startIndex: number, endIndex: number): boolean {
  const charBefore = startIndex > 0 ? text[startIndex - 1] : "";
  const charAfter = endIndex < text.length ? text[endIndex] : "";
  const pathSeparators = ["\\", "/", ":"];

  return pathSeparators.includes(charBefore) || pathSeparators.includes(charAfter);
}

/**
 * Detect all placeholder occurrences in normalized paragraph text.
 * Implements canonical grammar and overlap resolution rules.
 */
export function detectMatches(
  text: string,
  details: UploaderDetails
): DetectedMatch[] {
  const candidates: DetectedMatch[] = [];

  // Helper to find all regex occurrences with boundary verification
  function findRegexMatches(
    regex: RegExp,
    callback: (match: RegExpExecArray) => DetectedMatch | null
  ) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const matchObj = callback(m);
      if (matchObj) {
        candidates.push(matchObj);
      }
    }
  }

  // 1. ROLL NUMBER: strict whole-word token match
  const cleanRoll = details.rollNumber.trim();
  if (cleanRoll.length > 0) {
    const rollRegex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(cleanRoll)}(?![a-zA-Z0-9])`, "gi");
    findRegexMatches(rollRegex, (m) => ({
      type: "ROLL",
      placeholderText: "{{ROLL}}",
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      matchedText: m[0],
    }));
  }

  // 2. BATCH: whole-word token match (e.g. P1)
  const cleanBatch = details.batch.trim();
  if (cleanBatch.length > 0) {
    const batchRegex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(cleanBatch)}(?![a-zA-Z0-9])`, "gi");
    findRegexMatches(batchRegex, (m) => ({
      type: "BATCH",
      placeholderText: "{{BATCH}}",
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      matchedText: m[0],
    }));
  }

  // 3. DATE: multiple common formats
  if (details.fileDate) {
    const dateCandidates = generateDateCandidates(details.fileDate);
    for (const dc of dateCandidates) {
      const dateRegex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(dc.text)}(?![a-zA-Z0-9])`, "gi");
      findRegexMatches(dateRegex, (m) => ({
        type: "DATE",
        placeholderText: `{{DATE|fmt=${dc.fmt}}}`,
        startIndex: m.index,
        endIndex: m.index + m[0].length,
        matchedText: m[0],
      }));
    }
  }

  // 4. NAME TOKENS & ORDERINGS
  let F = details.firstName?.trim() || "";
  let M = details.middleName?.trim() || "";
  let S = details.surname?.trim() || "";

  if ((!F || !S) && details.fullName) {
    const nameTokens = details.fullName.trim().split(/\s+/).filter(Boolean);
    if (nameTokens.length >= 3) {
      // Default tokens: F first, M middle, S last
      if (!F) F = nameTokens[0];
      if (!M) M = nameTokens.slice(1, -1).join(" ");
      if (!S) S = nameTokens[nameTokens.length - 1];
    } else if (nameTokens.length === 2) {
      if (!F) F = nameTokens[0];
      if (!S) S = nameTokens[1];
    } else if (nameTokens.length === 1) {
      if (!F) F = nameTokens[0];
    }
  }

  const namePatterns: Array<{ pattern: string; order: string }> = [];

  if (F && M && S) {
    namePatterns.push(
      { pattern: `${F} ${M} ${S}`, order: "F-M-L" },
      { pattern: `${S} ${F} ${M}`, order: "L-F-M" },
      { pattern: `${F} ${S}`, order: "F-L" },
      { pattern: `${S} ${F}`, order: "L-F" },
      { pattern: F, order: "F" },
      { pattern: S, order: "L" }
    );
  } else if (F && S) {
    namePatterns.push(
      { pattern: `${F} ${S}`, order: "F-L" },
      { pattern: `${S} ${F}`, order: "L-F" },
      { pattern: F, order: "F" },
      { pattern: S, order: "L" },
      { pattern: S, order: "S" }
    );
  } else if (F) {
    namePatterns.push({ pattern: F, order: "F" });
  }

  for (const np of namePatterns) {
    // Allow matching whitespace flexibility (e.g. multiple spaces between names)
    const regexPattern = np.pattern
      .split(/\s+/)
      .map((tok) => escapeRegex(tok))
      .join("\\s+");

    const nameRegex = new RegExp(`(?<![a-zA-Z0-9])${regexPattern}(?![a-zA-Z0-9])`, "gi");
    findRegexMatches(nameRegex, (m) => {
      const caseStyle = detectCaseStyle(m[0]);
      return {
        type: "NAME",
        placeholderText: `{{NAME|order=${np.order}|case=${caseStyle}}}`,
        startIndex: m.index,
        endIndex: m.index + m[0].length,
        matchedText: m[0],
      };
    });
  }

  // 4b. Reversed string transform detection for first name (e.g. "Rahul" -> "luhaR")
  if (F && F.length >= 3) {
    const reversedF = F.split("").reverse().join("");
    const reversedRegex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(reversedF)}(?![a-zA-Z0-9])`, "gi");
    findRegexMatches(reversedRegex, (m) => {
      const caseStyle = detectCaseStyle(m[0]);
      return {
        type: "NAME",
        placeholderText: `{{NAME|order=F|case=${caseStyle}|transform=reverse}}`,
        startIndex: m.index,
        endIndex: m.index + m[0].length,
        matchedText: m[0],
      };
    });
  }

  // 5. FOLDER NAME: whole path segment
  const cleanFolder = details.folderName.trim();
  if (cleanFolder.length > 0) {
    // Delimited by path separators (\, /, :), quotes, whitespace, or boundaries
    const folderRegex = new RegExp(`(?<=[\\\\/:\\s"'(\\[{]|^)${escapeRegex(cleanFolder)}(?=[\\\\/:\\s"')\\]}]|$)`, "gi");
    findRegexMatches(folderRegex, (m) => {
      const caseStyle = detectCaseStyle(m[0]);
      const caseToken = caseStyle === "title" ? "asis" : caseStyle; // grammar supports asis, upper, lower
      return {
        type: "FOLDER",
        placeholderText: `{{FOLDER|case=${caseToken}}}`,
        startIndex: m.index,
        endIndex: m.index + m[0].length,
        matchedText: m[0],
      };
    });
  }

  // 6. Overlap Resolution & Tie-breaking
  // Sort candidates:
  // Primary: Length of matched text (descending: longest match wins)
  // Secondary: Disambiguation (if same range, path context favors FOLDER, non-path favors NAME)
  candidates.sort((a, b) => {
    const lenA = a.endIndex - a.startIndex;
    const lenB = b.endIndex - b.startIndex;
    if (lenB !== lenA) return lenB - lenA;

    // Tie-break: Folder vs Name
    if (a.startIndex === b.startIndex && a.endIndex === b.endIndex) {
      const inPath = isPathContext(text, a.startIndex, a.endIndex);
      if (a.type === "FOLDER" && b.type === "NAME") return inPath ? -1 : 1;
      if (a.type === "NAME" && b.type === "FOLDER") return inPath ? 1 : -1;
    }

    return a.startIndex - b.startIndex;
  });

  const finalMatches: DetectedMatch[] = [];
  const occupied = new Array(text.length).fill(false);

  for (const cand of candidates) {
    let hasConflict = false;
    for (let i = cand.startIndex; i < cand.endIndex; i++) {
      if (occupied[i]) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      // Check folder vs name tie-break on individual single-token matches
      if (cand.type === "NAME" && cand.placeholderText.includes("order=F") && details.folderName) {
        if (cand.matchedText.toLowerCase() === details.folderName.toLowerCase()) {
          if (isPathContext(text, cand.startIndex, cand.endIndex)) {
            const caseStyle = detectCaseStyle(cand.matchedText);
            const caseToken = caseStyle === "title" ? "asis" : caseStyle;
            cand.type = "FOLDER";
            cand.placeholderText = `{{FOLDER|case=${caseToken}}}`;
          }
        }
      }

      for (let i = cand.startIndex; i < cand.endIndex; i++) {
        occupied[i] = true;
      }
      finalMatches.push(cand);
    }
  }

  // Re-sort in ascending document character order
  return finalMatches.sort((a, b) => a.startIndex - b.startIndex);
}
