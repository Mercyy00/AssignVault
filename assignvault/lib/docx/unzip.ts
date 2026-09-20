import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Document } from "@xmldom/xmldom";

/**
 * Load a .docx buffer into a JSZip package.
 */
export async function loadDocx(buffer: Buffer): Promise<JSZip> {
  return await JSZip.loadAsync(buffer);
}

/**
 * Generate a node Buffer from a JSZip package.
 */
export async function generateDocx(zip: JSZip): Promise<Buffer> {
  return await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Parse an XML file inside the zip package into a DOM Document.
 * Returns null if the file does not exist in the archive.
 */
export async function getXmlDocument(
  zip: JSZip,
  filePath: string
): Promise<Document | null> {
  const file = zip.file(filePath);
  if (!file) return null;

  const content = await file.async("string");
  const parser = new DOMParser({
    onError: () => {},
  });

  return parser.parseFromString(content, "text/xml");
}

/**
 * Serialize a DOM Document back into an XML string and write it into the zip archive.
 */
export function setXmlDocument(
  zip: JSZip,
  filePath: string,
  doc: Document
): void {
  const serializer = new XMLSerializer();
  let xmlString = serializer.serializeToString(doc);

  // Ensure XML declaration is preserved if missing
  if (!xmlString.trimStart().startsWith("<?xml")) {
    xmlString = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xmlString}`;
  }

  zip.file(filePath, xmlString);
}

/**
 * Find all file paths in the zip package that match a given RegExp.
 */
export function getMatchingFiles(zip: JSZip, pattern: RegExp): string[] {
  return Object.keys(zip.files).filter((fileName) => pattern.test(fileName));
}
