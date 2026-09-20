import JSZip from "jszip";
import { getXmlDocument, setXmlDocument, getMatchingFiles, loadDocx, generateDocx } from "./unzip.ts";
import type { Element, Document } from "@xmldom/xmldom";

export interface DownloaderDetails {
  firstName: string;
  middleName?: string;
  surname: string;
  rollNumber: string;
  batch: string;
  customDate?: string;
  folderName?: string;
}

export interface FillOptions {
  watermark?: boolean;
}

/**
 * Apply casing to a string.
 */
export function applyCase(
  str: string,
  caseStyle: "upper" | "lower" | "title" | "asis" = "asis"
): string {
  if (caseStyle === "upper") return str.toUpperCase();
  if (caseStyle === "lower") return str.toLowerCase();
  if (caseStyle === "title") {
    return str
      .split(/(\s+)/)
      .map((part) => {
        if (/^\s+$/.test(part) || !part) return part;
        return part[0].toUpperCase() + part.slice(1).toLowerCase();
      })
      .join("");
  }
  return str;
}

/**
 * Format an ISO date (YYYY-MM-DD) according to the format tokens in fmt.
 */
export function formatDate(dateStr: string, fmt: string = "DD/MM/YYYY"): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;

  const yearNum = parseInt(parts[0], 10);
  const monthNum = parseInt(parts[1], 10); // 1-12
  const dayNum = parseInt(parts[2], 10); // 1-31

  if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
    return dateStr;
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const shortMonthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const fullMonth = monthNames[monthNum - 1] || "";
  const shortMonth = shortMonthNames[monthNum - 1] || "";
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  // Replace longest tokens first
  let result = fmt;
  result = result.replace(/\bYYYY\b/g, String(yearNum));
  result = result.replace(/\bYY\b/g, String(yearNum).slice(-2));
  result = result.replace(/\bMMMM\b/g, fullMonth);
  result = result.replace(/\bMMM\b/g, shortMonth);
  result = result.replace(/\bMM\b/g, pad2(monthNum));
  result = result.replace(/\bM\b/g, String(monthNum));
  result = result.replace(/\bDD\b/g, pad2(dayNum));
  result = result.replace(/\bD\b/g, String(dayNum));

  return result;
}

/**
 * Expand a single placeholder string like {{NAME|order=S-F-M|case=title|pad=98}}
 */
export function expandPlaceholder(
  placeholderType: string,
  optionsStr: string | undefined,
  details: DownloaderDetails
): string {
  const options = new Map<string, string>();
  if (optionsStr) {
    const pairs = optionsStr.split("|");
    for (const p of pairs) {
      const idx = p.indexOf("=");
      if (idx !== -1) {
        options.set(p.slice(0, idx).trim().toLowerCase(), p.slice(idx + 1).trim());
      }
    }
  }

  let value = "";
  const caseOption = (options.get("case") || "asis") as "upper" | "lower" | "title" | "asis";

  switch (placeholderType) {
    case "NAME": {
      const order = options.get("order") || "S-F-M";
      const roles = order.split("-").map((r) => r.trim().toUpperCase());
      const tokens: string[] = [];

      for (const r of roles) {
        if (r === "F") {
          if (details.firstName) tokens.push(details.firstName.trim());
        } else if (r === "M") {
          if (details.middleName && details.middleName.trim()) {
            tokens.push(details.middleName.trim());
          }
        } else if (r === "S" || r === "L") {
          if (details.surname) tokens.push(details.surname.trim());
        }
      }

      value = tokens.join(" ");
      value = applyCase(value, caseOption);

      if (options.get("transform") === "reverse") {
        // Reverse characters after casing
        value = value.split("").reverse().join("");
      }
      break;
    }

    case "ROLL": {
      value = details.rollNumber.trim();
      break;
    }

    case "BATCH": {
      value = details.batch.trim();
      break;
    }

    case "DATE": {
      const fmt = options.get("fmt") || "DD/MM/YYYY";
      if (!details.customDate) {
        throw new Error(
          "Template filling failed: missing date. A submission date is required to personalize this assignment."
        );
      }
      value = formatDate(details.customDate, fmt);
      break;
    }

    case "FOLDER": {
      const rawFolder = details.folderName || "assign";
      // Sanitize folder name: remove illegal path characters
      const sanitized = rawFolder.replace(/[\\/:*?"<>|]/g, "").slice(0, 32).trim();
      value = applyCase(sanitized || "assign", caseOption);
      break;
    }

    default:
      throw new Error(
        `Template filling failed: unexpanded placeholder "{{${placeholderType}${optionsStr ? `|${optionsStr}` : ""}}}"`
      );
  }

  // Handle pad=<n>
  const padStr = options.get("pad");
  if (padStr) {
    const padN = parseInt(padStr, 10);
    if (!isNaN(padN) && padN > 0) {
      const numSpaces = Math.max(3, padN - value.length);
      value += " ".repeat(numSpaces);
    }
  }

  return value;
}

/**
 * Consolidate any placeholder that is split across multiple <w:t> elements within a paragraph.
 * For example, if run 1 has "{{NA" and run 2 has "ME}}", merge them into run 1.
 */
function consolidateSplitPlaceholders(p: Element): void {
  const textNodes = p.getElementsByTagName("w:t");
  for (let i = 0; i < textNodes.length; i++) {
    const tElem = textNodes[i];
    let content = tElem.textContent || "";
    const lastOpen = content.lastIndexOf("{{");
    const lastClose = content.lastIndexOf("}}");

    if (lastOpen !== -1 && (lastClose === -1 || lastClose < lastOpen)) {
      // Split placeholder detected across runs
      let j = i + 1;
      while (j < textNodes.length) {
        const nextElem = textNodes[j];
        const nextContent = nextElem.textContent || "";
        content += nextContent;
        nextElem.textContent = "";
        const closeIdx = nextContent.indexOf("}}");
        if (closeIdx !== -1) {
          break;
        }
        j++;
      }
      tElem.textContent = content;
      if (content.startsWith(" ") || content.endsWith(" ") || content.includes("  ")) {
        tElem.setAttribute("xml:space", "preserve");
      }
    }
  }
}

/**
 * Replace all placeholders inside an XML Document tree in a strict single pass.
 * Performs replacement on <w:t> elements and ensures xml:space="preserve" is set.
 */
function fillDocumentXml(doc: Document, details: DownloaderDetails): void {
  const paragraphs = doc.getElementsByTagName("w:p");

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const p = paragraphs[pIdx];
    consolidateSplitPlaceholders(p);

    const textNodes = p.getElementsByTagName("w:t");
    for (let tIdx = 0; tIdx < textNodes.length; tIdx++) {
      const tElem = textNodes[tIdx];
      const text = tElem.textContent || "";
      if (!text.includes("{{")) continue;

      // Check for unclosed placeholder
      const openCount = (text.match(/\{\{/g) || []).length;
      const closeCount = (text.match(/\}\}/g) || []).length;
      if (openCount > closeCount) {
        throw new Error(
          `Template filling failed: unexpanded placeholder with unclosed "{{" in "${text}"`
        );
      }

      // Single-pass expansion: replaced text is never re-scanned
      const replaced = text.replace(
        /\{\{([A-Z0-9_]+)(?:\|([^}]+))?\}\}/g,
        (_match, type, opts) => expandPlaceholder(type, opts, details)
      );

      tElem.textContent = replaced;
      if (replaced.startsWith(" ") || replaced.endsWith(" ") || replaced.includes("  ")) {
        tElem.setAttribute("xml:space", "preserve");
      }
    }
  }
}

/**
 * Append reference copy watermark to the document's primary footer.
 */
async function appendWatermark(zip: JSZip): Promise<void> {
  // Find or use word/footer1.xml
  const footerFiles = getMatchingFiles(zip, /^word\/footer.*\.xml$/i);
  const targetFooterPath = footerFiles.length > 0 ? footerFiles[0] : "word/footer1.xml";
  const footerDoc = await getXmlDocument(zip, targetFooterPath);

  if (footerDoc) {
    const root = footerDoc.documentElement;
    if (root) {
      // Create watermark paragraph:
      // <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="888888"/><w:i/></w:rPr><w:t>Reference copy generated by AssignVault</w:t></w:r></w:p>
      const p = footerDoc.createElement("w:p");
      const pPr = footerDoc.createElement("w:pPr");
      const jc = footerDoc.createElement("w:jc");
      jc.setAttribute("w:val", "center");
      pPr.appendChild(jc);
      p.appendChild(pPr);

      const r = footerDoc.createElement("w:r");
      const rPr = footerDoc.createElement("w:rPr");
      const sz = footerDoc.createElement("w:sz");
      sz.setAttribute("w:val", "16");
      const color = footerDoc.createElement("w:color");
      color.setAttribute("w:val", "888888");
      const i = footerDoc.createElement("w:i");
      rPr.appendChild(sz);
      rPr.appendChild(color);
      rPr.appendChild(i);
      r.appendChild(rPr);

      const t = footerDoc.createElement("w:t");
      t.textContent = "Reference copy generated by AssignVault";
      r.appendChild(t);
      p.appendChild(r);

      root.appendChild(p);
      setXmlDocument(zip, targetFooterPath, footerDoc);
    }
  }
}

/**
 * Fill an approved template DOCX buffer with the downloader's personal details.
 *
 * @param templateBuffer The raw bytes of the approved template .docx
 * @param details Downloader details (First, Middle, Surname, Roll, Batch, Date, Folder)
 * @param options Optional flags such as watermark
 * @returns Personalized .docx Buffer
 * @throws Error if any unexpanded {{ placeholder remains after filling
 */
export async function fillTemplate(
  templateBuffer: Buffer,
  details: DownloaderDetails,
  options: FillOptions = {}
): Promise<Buffer> {
  const zip = await loadDocx(templateBuffer);

  // 1. Identify all XML parts that can contain placeholders
  const xmlPartsToProcess: string[] = [
    "word/document.xml",
    ...getMatchingFiles(zip, /^word\/header.*\.xml$/i),
    ...getMatchingFiles(zip, /^word\/footer.*\.xml$/i),
    ...getMatchingFiles(zip, /^word\/footnotes.*\.xml$/i),
    ...getMatchingFiles(zip, /^word\/endnotes.*\.xml$/i),
  ];

  // 2. Process each part preserving all non-text and unknown XML elements
  for (const partPath of xmlPartsToProcess) {
    const doc = await getXmlDocument(zip, partPath);
    if (!doc) continue;

    fillDocumentXml(doc, details);
    setXmlDocument(zip, partPath, doc);
  }

  // 3. Optional watermark in footer
  if (options.watermark) {
    await appendWatermark(zip);
  }

  // 4. Verify safety: ensure no unexpanded {{ remains in any part
  const userFields = [
    details.firstName,
    details.middleName,
    details.surname,
    details.rollNumber,
    details.batch,
    details.customDate,
    details.folderName,
  ].filter(Boolean) as string[];
  const userHasDoubleBrace = userFields.some((f) => f.includes("{{"));

  for (const partPath of xmlPartsToProcess) {
    const file = zip.file(partPath);
    if (!file) continue;
    const xmlContent = await file.async("string");

    if (!userHasDoubleBrace) {
      // Scan for unexpanded placeholder patterns like {{NAME...}} or {{ROLL}}
      const remainingMatch = xmlContent.match(/\{\{[A-Z0-9_]+(?:\|[^}]+)?\}\}/);
      if (remainingMatch) {
        throw new Error(
          `Template filling failed: unexpanded placeholder "${remainingMatch[0]}" remains in ${partPath}`
        );
      }
    }
  }

  // 5. Generate and return final personalized DOCX
  return await generateDocx(zip);
}
