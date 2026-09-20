import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

export interface TextExtractionResult {
  fullText: string;
  paragraphs: string[];
}

export interface CrossCheckResult {
  passed: boolean;
  foundRoll: boolean;
  foundName: boolean;
  matchedTokens: string[];
  error?: string;
}

/**
 * Extract text from a single Word XML part (document.xml, header.xml, footer.xml, etc.).
 * Concatenates runs per paragraph so text split across multiple <w:r>/<w:t> elements
 * (for example, "Jay" + "esh") is preserved and accurately reconstructed.
 */
export function extractTextFromXml(xmlString: string): string[] {
  const parser = new DOMParser({
    onError: () => {},
  });

  const doc = parser.parseFromString(xmlString, "text/xml");
  const paragraphNodes = doc.getElementsByTagName("w:p");
  const paragraphs: string[] = [];

  for (let i = 0; i < paragraphNodes.length; i++) {
    const p = paragraphNodes[i];
    let paragraphText = "";

    // Walk all descendants in document order looking for text, tabs, or line breaks
    const textNodes = p.getElementsByTagName("*");
    for (let j = 0; j < textNodes.length; j++) {
      const node = textNodes[j];
      const localName = node.localName || node.nodeName.replace(/^.*:/, "");

      if (localName === "t") {
        paragraphText += node.textContent || "";
      } else if (localName === "tab") {
        paragraphText += "\t";
      } else if (localName === "br" || localName === "cr") {
        paragraphText += "\n";
      }
    }

    // Normalize non-breaking spaces (\u00A0) and trim
    const normalized = paragraphText.replace(/\u00A0/g, " ");
    if (normalized.trim().length > 0) {
      paragraphs.push(normalized);
    }
  }

  return paragraphs;
}

/**
 * Extract all plain text from a DOCX package, including body, headers, and footers.
 */
export async function extractDocxText(zip: JSZip): Promise<TextExtractionResult> {
  const allParagraphs: string[] = [];

  // 1. Process word/document.xml
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (documentXml) {
    allParagraphs.push(...extractTextFromXml(documentXml));
  }

  // 2. Process headers and footers (word/header*.xml, word/footer*.xml)
  const headerFooterFiles = Object.keys(zip.files).filter((fileName) =>
    /^word\/(header|footer)\d*\.xml$/i.test(fileName)
  );

  for (const fileName of headerFooterFiles) {
    const xml = await zip.file(fileName)?.async("string");
    if (xml) {
      allParagraphs.push(...extractTextFromXml(xml));
    }
  }

  return {
    fullText: allParagraphs.join("\n"),
    paragraphs: allParagraphs,
  };
}

/**
 * Check if the uploader's roll number and at least one name token appear in the document.
 * Matches case-insensitively and handles whitespace normalization.
 */
export function crossCheckUploaderDetails(
  extractedText: string,
  fullName: string,
  rollNumber: string
): CrossCheckResult {
  const normalizedDocText = extractedText.replace(/\s+/g, " ").toLowerCase();
  const normalizedRoll = rollNumber.trim().toLowerCase();

  // 1. Check roll number presence
  const foundRoll =
    normalizedRoll.length > 0 && normalizedDocText.includes(normalizedRoll);

  // 2. Extract name tokens (min length 2 characters to exclude single initials)
  const nameTokens = fullName
    .trim()
    .toLowerCase()
    .split(/[\s.-]+/)
    .filter((token) => token.length >= 2);

  const matchedTokens: string[] = [];
  for (const token of nameTokens) {
    if (normalizedDocText.includes(token)) {
      matchedTokens.push(token);
    }
  }

  const foundName = matchedTokens.length > 0;
  const passed = foundRoll || foundName;

  if (!passed) {
    return {
      passed: false,
      foundRoll: false,
      foundName: false,
      matchedTokens: [],
      error:
        "We couldn't find your name or roll number in this file. Please check the details you entered.",
    };
  }

  return {
    passed: true,
    foundRoll,
    foundName,
    matchedTokens,
  };
}
