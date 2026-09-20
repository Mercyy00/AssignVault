import JSZip from "jszip";
import { getXmlDocument } from "./unzip.ts";
import { isLocalName } from "./paragraphs.ts";
import type { UploaderDetails } from "./detect.ts";
import type { Document, Element, Node } from "@xmldom/xmldom";

export type LocationType = "body" | "header" | "footer" | "table" | "textbox";

export interface LocationCountMap {
  body: number;
  header: number;
  footer: number;
  table: number;
  textbox: number;
}

export interface PlaceholderCounts {
  [placeholderType: string]: {
    total: number;
    locations: LocationCountMap;
  };
}

export interface ImageInventoryItem {
  mediaPath: string;
  relationshipId: string;
  widthEmu: number;
  heightEmu: number;
  paragraphIndex: number;
}

export interface TemplateWarning {
  type?: string;
  message: string;
  excerpt?: string;
}

export interface TemplateReport {
  placeholderCounts: PlaceholderCounts;
  warnings: Array<string | TemplateWarning>;
  outputImages: ImageInventoryItem[];
  needsReview: boolean;
}

/**
 * Determine the semantic location of a paragraph within the document structure.
 */
export function determineParagraphLocation(
  p: Element,
  fileContext: "document" | "header" | "footer"
): LocationType {
  if (fileContext === "header") return "header";
  if (fileContext === "footer") return "footer";

  // Check ancestors for text box or table
  let current: Node | null = p.parentNode;
  while (current && current.nodeType === 1) {
    if (isLocalName(current, "txbxContent") || isLocalName(current, "textbox")) {
      return "textbox";
    }
    if (isLocalName(current, "tc")) {
      return "table";
    }
    current = current.parentNode;
  }

  return "body";
}

/**
 * Scan document.xml for images and resolve their relationship IDs and dimensions.
 */
export async function inventoryImages(
  zip: JSZip,
  documentDoc: Document
): Promise<ImageInventoryItem[]> {
  const images: ImageInventoryItem[] = [];

  // Parse document relationships to resolve relationshipId -> target media path
  const relsDoc = await getXmlDocument(zip, "word/_rels/document.xml.rels");
  const relMap = new Map<string, string>();

  if (relsDoc) {
    const relElements = relsDoc.getElementsByTagName("Relationship");
    for (let i = 0; i < relElements.length; i++) {
      const rel = relElements[i];
      const id = rel.getAttribute("Id");
      const target = rel.getAttribute("Target");
      if (id && target) {
        // Targets are typically "media/image1.png"
        const cleanTarget = target.startsWith("word/") ? target : `word/${target.replace(/^\//, "")}`;
        relMap.set(id, cleanTarget);
      }
    }
  }

  // Iterate all paragraphs in document.xml in order
  const paragraphs = documentDoc.getElementsByTagName("w:p");

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const p = paragraphs[pIdx];
    const drawings = p.getElementsByTagName("w:drawing");

    for (let dIdx = 0; dIdx < drawings.length; dIdx++) {
      const drawing = drawings[dIdx];

      // Extract width and height from <wp:extent cx="..." cy="..."/>
      let widthEmu = 0;
      let heightEmu = 0;
      const extents = drawing.getElementsByTagName("wp:extent");
      if (extents.length > 0) {
        widthEmu = parseInt(extents[0].getAttribute("cx") || "0", 10);
        heightEmu = parseInt(extents[0].getAttribute("cy") || "0", 10);
      }

      // Extract blip embed ID from <a:blip r:embed="..."/>
      let relationshipId = "";
      const blips = drawing.getElementsByTagName("a:blip");
      if (blips.length > 0) {
        relationshipId =
          blips[0].getAttribute("r:embed") ||
          blips[0].getAttribute("r:link") ||
          blips[0].getAttribute("embed") ||
          "";
      }

      if (relationshipId) {
        const mediaPath = relMap.get(relationshipId) || `word/media/${relationshipId}`;
        images.push({
          mediaPath,
          relationshipId,
          widthEmu,
          heightEmu,
          paragraphIndex: pIdx,
        });
      }
    }
  }

  return images;
}

/**
 * Scan all XML parts for residual occurrences of uploader details after replacements.
 */
export async function scanResidualLeaks(
  zip: JSZip,
  details: UploaderDetails
): Promise<string[]> {
  const warnings: string[] = [];
  const textFiles = Object.keys(zip.files).filter(
    (name) =>
      name.endsWith(".xml") &&
      !name.startsWith("word/media/") &&
      !name.endsWith(".rels")
  );

  const cleanRoll = details.rollNumber.trim().toLowerCase();
  const cleanFolder = (details.folderName || "").trim().toLowerCase();
  const fullNameStr =
    details.fullName ||
    [details.firstName, details.middleName, details.surname].filter(Boolean).join(" ");
  const nameTokens = fullNameStr
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((tok) => tok.length >= 3); // check meaningful tokens (exclude initials)

  for (const fileName of textFiles) {
    const content = await zip.file(fileName)?.async("string");
    if (!content) continue;

    const lower = content.toLowerCase();

    // Check roll number with non-alphanumeric boundary
    if (cleanRoll.length > 0) {
      const rollRegex = new RegExp(`(?<![a-zA-Z0-9])${cleanRoll}(?![a-zA-Z0-9])`, "i");
      if (rollRegex.test(lower)) {
        warnings.push(`Residual roll number "${details.rollNumber}" found in ${fileName}`);
      }
    }

    // Check full name or individual significant name tokens
    for (const token of nameTokens) {
      const tokenRegex = new RegExp(`(?<![a-zA-Z0-9])${token}(?![a-zA-Z0-9])`, "i");
      if (tokenRegex.test(lower)) {
        warnings.push(`Residual name token "${token}" found in ${fileName}`);
      }
    }

    // Check folder name if distinct from common words
    if (cleanFolder.length >= 3 && !["code", "main", "test", "file", "app"].includes(cleanFolder)) {
      const folderRegex = new RegExp(`(?<![a-zA-Z0-9])${cleanFolder}(?![a-zA-Z0-9])`, "i");
      if (folderRegex.test(lower)) {
        warnings.push(`Residual folder name "${details.folderName}" found in ${fileName}`);
      }
    }
  }

  return warnings;
}
