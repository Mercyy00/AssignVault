import type { Element, Node } from "@xmldom/xmldom";

export interface TextCharMap {
  char: string;
  runElement: Element;
  textNode: Node | null; // null for <w:tab/>, <w:br/>, <w:cr/>
  offsetInTextNode: number;
  isControl: boolean;
}

export interface ParagraphTextModel {
  paragraphElement: Element;
  fullText: string;
  normalizedText: string;
  charMap: TextCharMap[];
}

/**
 * Check if the given element's localName matches target name regardless of prefix.
 */
export function isLocalName(node: Node, targetName: string): boolean {
  if (node.nodeType !== 1) return false;
  const local = (node as Element).localName || node.nodeName.replace(/^.*:/, "");
  return local.toLowerCase() === targetName.toLowerCase();
}

/**
 * Retrieve all <w:p> paragraph elements in document order.
 * Works across document body, headers, footers, tables, and text boxes.
 */
export function getAllParagraphs(rootNode: Node): Element[] {
  const paragraphs: Element[] = [];

  function walk(current: Node) {
    if (isLocalName(current, "p")) {
      paragraphs.push(current as Element);
    }
    const children = current.childNodes;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        walk(children[i]);
      }
    }
  }

  walk(rootNode);
  return paragraphs;
}

/**
 * Build a character-by-character mapped model of a single paragraph's text.
 * Preserves relationships back to the specific <w:r> runs and text node offsets.
 * Does not traverse into nested paragraphs (e.g. inside nested textboxes).
 */
export function buildParagraphTextModel(p: Element): ParagraphTextModel {
  const charMap: TextCharMap[] = [];
  let fullText = "";

  function walkParagraphDescendants(current: Node) {
    // If we encounter a nested paragraph, do not process its contents here
    if (current !== p && isLocalName(current, "p")) {
      return;
    }

    if (isLocalName(current, "r")) {
      const runElement = current as Element;
      const runChildren = runElement.childNodes;

      for (let i = 0; i < runChildren.length; i++) {
        const child = runChildren[i];

        if (isLocalName(child, "t")) {
          // <w:t> contains the text content
          const textContent = child.textContent || "";
          // Find or ensure a Text node child exists
          const targetTextNode: Node = child.firstChild || child;

          for (let offset = 0; offset < textContent.length; offset++) {
            const ch = textContent[offset];
            fullText += ch;
            charMap.push({
              char: ch,
              runElement,
              textNode: targetTextNode,
              offsetInTextNode: offset,
              isControl: false,
            });
          }
        } else if (isLocalName(child, "tab")) {
          fullText += "\t";
          charMap.push({
            char: "\t",
            runElement,
            textNode: null,
            offsetInTextNode: 0,
            isControl: true,
          });
        } else if (isLocalName(child, "br") || isLocalName(child, "cr")) {
          fullText += "\n";
          charMap.push({
            char: "\n",
            runElement,
            textNode: null,
            offsetInTextNode: 0,
            isControl: true,
          });
        }
      }
      return;
    }

    const children = current.childNodes;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        walkParagraphDescendants(children[i]);
      }
    }
  }

  walkParagraphDescendants(p);

  // Normalize non-breaking spaces (\u00A0) and standard whitespace for matching
  const normalizedText = fullText.replace(/\u00A0/g, " ");

  return {
    paragraphElement: p,
    fullText,
    normalizedText,
    charMap,
  };
}
