import type { ParagraphTextModel } from "./paragraphs.ts";
import type { DetectedMatch } from "./detect.ts";
import { isLocalName } from "./paragraphs.ts";
import type { Element, Node } from "@xmldom/xmldom";

/**
 * Clean up empty runs from a paragraph.
 * A run is removed only if it has no text, no drawings, and no control characters.
 */
function cleanEmptyRuns(p: Element) {
  const children = p.childNodes;
  if (!children) return;

  const toRemove: Node[] = [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (isLocalName(node, "r")) {
      const run = node as Element;
      // Check if run has meaningful content
      const hasDrawing = run.getElementsByTagName("w:drawing").length > 0 ||
                         run.getElementsByTagName("drawing").length > 0;
      const hasTab = run.getElementsByTagName("w:tab").length > 0 ||
                     run.getElementsByTagName("tab").length > 0;
      const hasBreak = run.getElementsByTagName("w:br").length > 0 ||
                       run.getElementsByTagName("br").length > 0;
      const textNodes = run.getElementsByTagName("w:t");
      let totalText = "";
      for (let j = 0; j < textNodes.length; j++) {
        totalText += textNodes[j].textContent || "";
      }

      if (!hasDrawing && !hasTab && !hasBreak && totalText.length === 0) {
        toRemove.push(run);
      }
    }
  }

  for (const r of toRemove) {
    p.removeChild(r);
  }
}

/**
 * Apply detected placeholder replacements to the DOM of a single paragraph.
 * Processes matches in reverse order so character offsets in charMap remain stable.
 * Preserves the run formatting (<w:rPr>) where the match began.
 */
export function applyReplacementsToParagraph(
  model: ParagraphTextModel,
  matches: DetectedMatch[]
): number {
  if (matches.length === 0) return 0;

  // Process matches in descending order of startIndex to preserve offset validity
  const sortedMatches = [...matches].sort((a, b) => b.startIndex - a.startIndex);
  let appliedCount = 0;

  for (const match of sortedMatches) {
    const startIdx = match.startIndex;
    const endIdx = match.endIndex - 1; // inclusive last char

    if (startIdx < 0 || endIdx >= model.charMap.length) continue;

    const startEntry = model.charMap[startIdx];
    const endEntry = model.charMap[endIdx];

    // Find the first valid text node in the match range
    let firstTextEntry = startEntry;
    let firstTextIdx = startIdx;
    while (firstTextIdx <= endIdx && (!firstTextEntry.textNode || firstTextEntry.isControl)) {
      firstTextIdx++;
      if (firstTextIdx < model.charMap.length) {
        firstTextEntry = model.charMap[firstTextIdx];
      }
    }

    // Find the last valid text node in the match range
    let lastTextEntry = endEntry;
    let lastTextIdx = endIdx;
    while (lastTextIdx >= startIdx && (!lastTextEntry.textNode || lastTextEntry.isControl)) {
      lastTextIdx--;
      if (lastTextIdx >= 0) {
        lastTextEntry = model.charMap[lastTextIdx];
      }
    }

    if (!firstTextEntry.textNode || !lastTextEntry.textNode) {
      continue;
    }

    const firstNode = firstTextEntry.textNode;
    const lastNode = lastTextEntry.textNode;
    const firstOffset = firstTextEntry.offsetInTextNode;
    const lastOffset = lastTextEntry.offsetInTextNode;

    const firstVal = firstNode.nodeValue || "";
    const lastVal = lastNode.nodeValue || "";

    if (firstNode === lastNode) {
      // Entire match is contained in a single text node
      const prefix = firstVal.substring(0, firstOffset);
      const suffix = firstVal.substring(lastOffset + 1);
      firstNode.nodeValue = prefix + match.placeholderText + suffix;

      const parentEl = firstNode.parentNode as Element | null;
      if (parentEl && isLocalName(parentEl, "t")) {
        const fullVal = firstNode.nodeValue || "";
        if (fullVal.startsWith(" ") || fullVal.endsWith(" ") || fullVal.includes("  ")) {
          parentEl.setAttribute("xml:space", "preserve");
        }
      }
    } else {
      // Match spans across multiple text nodes/runs:
      // 1. First text node gets the prefix + placeholder text
      const prefix = firstVal.substring(0, firstOffset);
      firstNode.nodeValue = prefix + match.placeholderText;

      const firstParent = firstNode.parentNode as Element | null;
      if (firstParent && isLocalName(firstParent, "t")) {
        firstParent.setAttribute("xml:space", "preserve");
      }

      // 2. Intermediate text nodes are cleared
      const intermediateNodes = new Set<Node>();
      for (let i = firstTextIdx + 1; i < lastTextIdx; i++) {
        const entry = model.charMap[i];
        if (entry.textNode && entry.textNode !== firstNode && entry.textNode !== lastNode) {
          intermediateNodes.add(entry.textNode);
        }
      }
      for (const node of intermediateNodes) {
        node.nodeValue = "";
      }

      // 3. Last text node retains only its suffix
      const suffix = lastVal.substring(lastOffset + 1);
      lastNode.nodeValue = suffix;
    }

    appliedCount++;
  }

  // Remove empty runs left behind
  cleanEmptyRuns(model.paragraphElement);
  return appliedCount;
}
