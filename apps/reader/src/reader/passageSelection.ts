import { displayedText } from "./annotations";
import type { PassageRange, TextAnchor } from "./annotations";
import { nextFlowIndex, previousFlowIndex } from "./notes";
import type { ParagraphPositions } from "./readerState";
import type { Paragraph } from "./types";

/**
 * Selections in the reading viewport, mapped back onto the source.
 *
 * Every run of source text the viewport renders carries `data-text-start`,
 * its offset in the paragraph's displayed text, inside a block that names the
 * paragraph. Nothing else does — note chips, page counters, captions — so a
 * resolved passage only ever holds words the source itself says.
 */

/** Whether the reader is holding a text selection anywhere on the page. */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

/**
 * Source anchors for a DOM range inside `root`, trimmed of surrounding blanks.
 *
 * Null when the range holds no source text at all (only chips or captions).
 */
export function resolvePassage(
  root: HTMLElement,
  range: Range,
  paragraphs: Paragraph[],
  positions: ParagraphPositions,
): PassageRange | null {
  let start: TextAnchor | null = null;
  let end: TextAnchor | null = null;
  for (const segment of root.querySelectorAll<HTMLElement>("[data-text-start]")) {
    if (!range.intersectsNode(segment)) continue;
    const paragraphId = segment.closest<HTMLElement>("[data-paragraph-id]")?.dataset.paragraphId;
    const base = Number(segment.dataset.textStart);
    if (!paragraphId || !Number.isFinite(base)) continue;
    start ??= {
      paragraphId,
      offset:
        base +
        (segment.contains(range.startContainer)
          ? offsetWithin(segment, range.startContainer, range.startOffset)
          : 0),
    };
    end = {
      paragraphId,
      offset:
        base +
        (segment.contains(range.endContainer)
          ? offsetWithin(segment, range.endContainer, range.endOffset)
          : (segment.textContent ?? "").length),
    };
  }
  if (!start || !end) return null;
  return trimPassage({ start, end }, paragraphs, positions);
}

function offsetWithin(segment: HTMLElement, node: Node, offset: number): number {
  const probe = segment.ownerDocument.createRange();
  probe.setStart(segment, 0);
  probe.setEnd(node, offset);
  return probe.toString().length;
}

const BLANK = /\s/u;

/**
 * Pull both ends inward past blanks and line ends, so a sweep that began in a
 * paragraph gap or ended on a line break anchors on the words themselves.
 */
function trimPassage(
  range: PassageRange,
  paragraphs: Paragraph[],
  positions: ParagraphPositions,
): PassageRange | null {
  let startIndex = positions.get(range.start.paragraphId);
  let endIndex = positions.get(range.end.paragraphId);
  if (startIndex === undefined || endIndex === undefined) return null;
  let startText = displayedText(paragraphs[startIndex]);
  let endText = displayedText(paragraphs[endIndex]);
  let startOffset = Math.min(range.start.offset, startText.length);
  let endOffset = Math.min(range.end.offset, endText.length);

  for (;;) {
    while (startOffset < startText.length && BLANK.test(startText[startOffset])) {
      startOffset += 1;
    }
    if (startOffset < startText.length || startIndex >= endIndex) break;
    const following = nextFlowIndex(paragraphs, startIndex);
    if (following === startIndex || following > endIndex) break;
    startIndex = following;
    startText = displayedText(paragraphs[startIndex]);
    startOffset = 0;
  }
  for (;;) {
    while (endOffset > 0 && BLANK.test(endText[endOffset - 1])) endOffset -= 1;
    if (endOffset > 0 || endIndex <= startIndex) break;
    const preceding = previousFlowIndex(paragraphs, endIndex, startIndex);
    if (preceding === endIndex) break;
    endIndex = preceding;
    endText = displayedText(paragraphs[endIndex]);
    endOffset = endText.length;
  }

  if (startIndex > endIndex || (startIndex === endIndex && startOffset >= endOffset)) {
    return null;
  }
  return {
    start: { paragraphId: paragraphs[startIndex].id, offset: startOffset },
    end: { paragraphId: paragraphs[endIndex].id, offset: endOffset },
  };
}

