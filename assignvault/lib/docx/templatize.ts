import { loadDocx, generateDocx, getXmlDocument, setXmlDocument, getMatchingFiles } from "./unzip.ts";
import { getAllParagraphs, buildParagraphTextModel } from "./paragraphs.ts";
import { extractDocxText } from "./extractText.ts";
import type { UploaderDetails, PlaceholderType, DetectedMatch } from "./detect.ts";
import { detectMatches } from "./detect.ts";
import { applyReplacementsToParagraph } from "./replace.ts";
import { scrubMetadata } from "./metadata.ts";
import type { TemplateReport, PlaceholderCounts, TemplateWarning } from "./report.ts";
import {
  determineParagraphLocation,
  inventoryImages,
  scanResidualLeaks,
} from "./report.ts";
import {
  isOutputRegionStart,
  isOutputRegionEnd,
  isSourceCodeStart,
  processOutputParagraph,
  createInitialOutputState,
} from "./outputs.ts";

export interface TemplatizeOptions {
  isConvertedFromPdf?: boolean;
}

export interface TemplatizeResult {
  templateBuffer: Buffer;
  report: TemplateReport;
  needsReview: boolean;
  requiresFolder: boolean;
}

function createEmptyCounts(): PlaceholderCounts {
  const types: PlaceholderType[] = ["NAME", "ROLL", "BATCH", "DATE", "FOLDER"];
  const counts: Partial<PlaceholderCounts> = {};

  for (const t of types) {
    counts[t] = {
      total: 0,
      locations: {
        body: 0,
        header: 0,
        footer: 0,
        table: 0,
        textbox: 0,
      },
    };
  }

  return counts as PlaceholderCounts;
}

/**
 * Transform an uploader's completed assignment .docx into a reusable template.
 * Detects occurrences of personal details and substitutes canonical placeholders
 * while preserving layout, fonts, and document structure.
 */
export async function templatize(
  docxBuffer: Buffer,
  details: UploaderDetails,
  options: TemplatizeOptions = {}
): Promise<TemplatizeResult> {
  const zip = await loadDocx(docxBuffer);
  const placeholderCounts = createEmptyCounts();

  // 0. Auto-discover roll number if uploader roll number does not match document text
  const effectiveDetails: UploaderDetails = { ...details };
  const cleanRoll = details.rollNumber?.trim() || "";
  if (cleanRoll) {
    const extracted = await extractDocxText(zip);
    const fullText = extracted.fullText;
    const rollRegex = new RegExp(`(?<![a-zA-Z0-9])${cleanRoll}(?![a-zA-Z0-9])`, "i");

    if (!rollRegex.test(fullText)) {
      // Uploader roll was not found. Look for labeled roll number patterns
      const labeledRollRegex = /(?:Roll\s*(?:No\.?|Number)?|Roll_No)\s*[:\-]?\s*([A-Za-z0-9]{1,12})/gi;
      const foundRolls = new Map<string, number>();
      let lm: RegExpExecArray | null;
      while ((lm = labeledRollRegex.exec(fullText)) !== null) {
        const val = lm[1].trim();
        if (/\d/.test(val) && !/^(none|na|nil|null)$/i.test(val)) {
          foundRolls.set(val, (foundRolls.get(val) || 0) + 1);
        }
      }

      let bestRoll = "";
      let maxCount = 0;
      for (const [candidate, count] of foundRolls.entries()) {
        if (count > maxCount) {
          maxCount = count;
          bestRoll = candidate;
        }
      }

      if (bestRoll && maxCount > 0) {
        effectiveDetails.rollNumber = bestRoll;
      }
    }
  }

  // 1. Identify all XML parts to process
  interface PartTarget {
    path: string;
    context: "document" | "header" | "footer";
  }

  const partsToProcess: PartTarget[] = [
    { path: "word/document.xml", context: "document" },
  ];

  // Add all header and footer parts
  const headerFiles = getMatchingFiles(zip, /^word\/header\d*\.xml$/i);
  for (const h of headerFiles) {
    partsToProcess.push({ path: h, context: "header" });
  }

  const footerFiles = getMatchingFiles(zip, /^word\/footer\d*\.xml$/i);
  for (const f of footerFiles) {
    partsToProcess.push({ path: f, context: "footer" });
  }

  // Add footnotes and endnotes if present
  if (zip.file("word/footnotes.xml")) {
    partsToProcess.push({ path: "word/footnotes.xml", context: "document" });
  }
  if (zip.file("word/endnotes.xml")) {
    partsToProcess.push({ path: "word/endnotes.xml", context: "document" });
  }

  // 2. Process paragraphs in each part
  const derivedOutputWarnings: TemplateWarning[] = [];
  let derivedOutputNeedsReview = false;
  let hasRequiresFolder = false;

  for (const part of partsToProcess) {
    const doc = await getXmlDocument(zip, part.path);
    if (!doc) continue;

    const paragraphs = getAllParagraphs(doc);
    let modified = false;
    const isMainDoc = part.path === "word/document.xml";
    const outputState = createInitialOutputState();

    for (const p of paragraphs) {
      const location = determineParagraphLocation(p, part.context);
      const model = buildParagraphTextModel(p);

      if (model.fullText.trim().length === 0) continue;

      let matches: DetectedMatch[] = [];

      if (isMainDoc) {
        const normText = model.normalizedText;

        // Track region boundaries in document sequence
        if (isOutputRegionStart(normText)) {
          outputState.inOutputRegion = true;
          outputState.inSourceCode = false;
          outputState.hasNameEcho = false;
          outputState.echoedTokens = [];
        } else if (isOutputRegionEnd(normText)) {
          outputState.inOutputRegion = false;
          outputState.inSourceCode = false;
          outputState.hasNameEcho = false;
          outputState.echoedTokens = [];
        } else if (isSourceCodeStart(normText)) {
          outputState.inSourceCode = true;
          outputState.inOutputRegion = false;
          outputState.hasNameEcho = false;
          outputState.echoedTokens = [];
        }

        if (outputState.inOutputRegion) {
          const outRes = processOutputParagraph(model, effectiveDetails, outputState);
          matches = outRes.matches;
          if (outRes.warnings.length > 0) {
            derivedOutputWarnings.push(...outRes.warnings);
          }
          if (outRes.needsReview) {
            derivedOutputNeedsReview = true;
          }
          if (outputState.requiresFolder) {
            hasRequiresFolder = true;
          }
        } else if (outputState.inSourceCode) {
          // Rule: Names never replaced inside source code lines outside output regions
          const rawMatches = detectMatches(normText, effectiveDetails);
          matches = rawMatches.filter((m) => m.type !== "NAME");
        } else {
          matches = detectMatches(normText, effectiveDetails);
        }
      } else {
        // Headers, footers, footnotes: standard matching
        matches = detectMatches(model.normalizedText, effectiveDetails);
      }

      if (matches.length > 0) {
        const applied = applyReplacementsToParagraph(model, matches);
        if (applied > 0) {
          modified = true;
          for (const m of matches) {
            placeholderCounts[m.type].total++;
            placeholderCounts[m.type].locations[location]++;
          }
        }
      }
    }

    if (modified) {
      setXmlDocument(zip, part.path, doc);
    }
  }

  // 3. Image inventory (from word/document.xml)
  const mainDoc = await getXmlDocument(zip, "word/document.xml");
  const outputImages = mainDoc ? await inventoryImages(zip, mainDoc) : [];

  // 4. Scrub document metadata and comments
  await scrubMetadata(zip);

  // 5. Scan for residual leaks after all replacements
  const residualWarnings = await scanResidualLeaks(zip, effectiveDetails);

  // 6. Compile warnings
  const warnings: Array<string | TemplateWarning> = [];

  if (placeholderCounts.NAME.total === 0) {
    warnings.push("Uploader name was not detected in the document.");
  }
  if (placeholderCounts.ROLL.total === 0) {
    warnings.push("Uploader roll number was not detected in the document.");
  }
  if (placeholderCounts.DATE.total === 0) {
    warnings.push("Uploader date was not detected in the document.");
  }
  if (placeholderCounts.FOLDER.total === 0) {
    warnings.push("Terminal folder name was not detected in the document.");
  }
  if (outputImages.length > 0) {
    warnings.push(
      `Document contains ${outputImages.length} image(s); terminal output may be an image.`
    );
  }

  if (options.isConvertedFromPdf) {
    warnings.unshift("Document was converted from PDF; manual review required.");
  }

  warnings.push(...residualWarnings);
  warnings.push(...derivedOutputWarnings);

  // 7. Determine needs_review status and folder requirement
  const isPdf = Boolean(options.isConvertedFromPdf);
  const severeWarning =
    placeholderCounts.NAME.total === 0 ||
    placeholderCounts.ROLL.total === 0 ||
    residualWarnings.length > 0;

  const needsReview = isPdf || severeWarning || derivedOutputNeedsReview;
  const requiresFolder = Boolean(
    hasRequiresFolder || (placeholderCounts.FOLDER && placeholderCounts.FOLDER.total > 0)
  );

  const report: TemplateReport = {
    placeholderCounts,
    warnings,
    outputImages,
    needsReview,
  };

  // 8. Generate finalized template package
  const templateBuffer = await generateDocx(zip);

  return {
    templateBuffer,
    report,
    needsReview,
    requiresFolder,
  };
}
