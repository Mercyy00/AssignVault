import JSZip from "jszip";
import { getXmlDocument, setXmlDocument } from "./unzip.ts";

/**
 * Scrub identifying author and metadata fields from the DOCX package.
 * Blanks creator, last modified by, company, comments, and tracked change authors.
 */
export async function scrubMetadata(zip: JSZip): Promise<void> {
  // 1. Process docProps/core.xml
  const coreDoc = await getXmlDocument(zip, "docProps/core.xml");
  if (coreDoc) {
    const fieldsToClear = [
      "creator",
      "lastModifiedBy",
      "description",
      "keywords",
      "category",
    ];

    for (const field of fieldsToClear) {
      const elements = coreDoc.getElementsByTagName(`dc:${field}`);
      for (let i = 0; i < elements.length; i++) {
        elements[i].textContent = "";
      }
      const cpElements = coreDoc.getElementsByTagName(`cp:${field}`);
      for (let i = 0; i < cpElements.length; i++) {
        cpElements[i].textContent = "";
      }
    }
    setXmlDocument(zip, "docProps/core.xml", coreDoc);
  }

  // 2. Process docProps/app.xml
  const appDoc = await getXmlDocument(zip, "docProps/app.xml");
  if (appDoc) {
    const appFields = ["Company", "Manager"];
    for (const field of appFields) {
      const elements = appDoc.getElementsByTagName(field);
      for (let i = 0; i < elements.length; i++) {
        elements[i].textContent = "";
      }
    }
    setXmlDocument(zip, "docProps/app.xml", appDoc);
  }

  // 3. Remove comments if present
  if (zip.file("word/comments.xml")) {
    const commentsDoc = await getXmlDocument(zip, "word/comments.xml");
    if (commentsDoc) {
      const comments = commentsDoc.getElementsByTagName("w:comment");
      for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];
        comment.parentNode?.removeChild(comment);
      }
      setXmlDocument(zip, "word/comments.xml", commentsDoc);
    }
  }

  // 4. Clean tracked changes author attributes in word/document.xml
  const documentDoc = await getXmlDocument(zip, "word/document.xml");
  if (documentDoc) {
    const trackedTags = ["w:ins", "w:del", "w:rPrChange", "w:pPrChange", "w:sectPrChange"];
    for (const tag of trackedTags) {
      const elements = documentDoc.getElementsByTagName(tag);
      for (let i = 0; i < elements.length; i++) {
        if (elements[i].hasAttribute("w:author")) {
          elements[i].setAttribute("w:author", "Author");
        }
      }
    }
    setXmlDocument(zip, "word/document.xml", documentDoc);
  }
}
