import type { Paragraph } from "./types";

/**
 * Apparatus paragraphs a scholarly edition carries inside the source text.
 *
 * `note` paragraphs are the editors' annotations printed after each chapter;
 * `nav` paragraphs are print navigation (tables of contents). Both stay in the
 * immutable source, but the Reader keeps them out of the linear tap-through
 * flow: notes surface on demand from their in-text markers instead.
 */
const SKIPPED_KINDS = new Set(["note", "nav"]);

export function isFlowParagraph(paragraph: Paragraph): boolean {
  return !SKIPPED_KINDS.has(paragraph.kind);
}

/** The next flow paragraph strictly after `from`, or `from` when none is left. */
export function nextFlowIndex(paragraphs: Paragraph[], from: number): number {
  for (let index = from + 1; index < paragraphs.length; index += 1) {
    if (isFlowParagraph(paragraphs[index])) return index;
  }
  return from;
}

/** The previous flow paragraph at or above `floor`, or `from` when none is left. */
export function previousFlowIndex(
  paragraphs: Paragraph[],
  from: number,
  floor: number,
): number {
  for (let index = from - 1; index >= Math.max(0, floor); index -= 1) {
    if (isFlowParagraph(paragraphs[index])) return index;
  }
  return from;
}

/** The last readable flow position; the book "ends" here, not on trailing notes. */
export function lastFlowIndex(paragraphs: Paragraph[]): number {
  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    if (isFlowParagraph(paragraphs[index])) return index;
  }
  return paragraphs.length - 1;
}

/**
 * Land a restored or requested position on the reading flow.
 *
 * Progress saved before apparatus support (or a jump aimed at a note) would
 * otherwise strand the cursor on a paragraph the flow never visits.
 */
export function snapToFlow(paragraphs: Paragraph[], index: number): number {
  const clamped = Math.max(0, Math.min(index, paragraphs.length - 1));
  if (isFlowParagraph(paragraphs[clamped])) return clamped;
  const forward = nextFlowIndex(paragraphs, clamped);
  if (forward !== clamped) return forward;
  return previousFlowIndex(paragraphs, clamped, 0);
}

/** How many flow paragraphs sit in [0, index]; drives the progress figure. */
export function flowPositionCounts(paragraphs: Paragraph[]): number[] {
  const counts = new Array<number>(paragraphs.length);
  let seen = 0;
  for (let index = 0; index < paragraphs.length; index += 1) {
    if (isFlowParagraph(paragraphs[index])) seen += 1;
    counts[index] = seen;
  }
  return counts;
}

/**
 * Note markers as the 红研所-style editions print them: sequential arabic
 * annotations `[1]` and 校记 counters in CJK brackets `〔一〕`.
 */
const MARKER_PATTERN = /\[\d+\]|〔[一二三四五六七八九十〇○百]+〕/g;

export interface TextSegment {
  kind: "text" | "marker";
  value: string;
}

/** Split paragraph text so markers can render as interactive superscripts. */
export function segmentMarkers(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MARKER_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ kind: "text", value: text.slice(cursor, start) });
    segments.push({ kind: "marker", value: match[0] });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
  return segments;
}

/**
 * The notes belonging to the chapter that contains `index`.
 *
 * A chapter's annotations are the `note` paragraphs printed between its
 * heading and the next heading, each opening with its own marker.
 */
export function chapterNotes(paragraphs: Paragraph[], index: number): Map<string, number> {
  let start = 0;
  for (let cursor = Math.min(index, paragraphs.length - 1); cursor >= 0; cursor -= 1) {
    if (paragraphs[cursor].kind === "chapter_heading") {
      start = cursor;
      break;
    }
  }
  const notes = new Map<string, number>();
  for (let cursor = start + 1; cursor < paragraphs.length; cursor += 1) {
    const paragraph = paragraphs[cursor];
    if (paragraph.kind === "chapter_heading") break;
    if (paragraph.kind !== "note") continue;
    const marker = paragraph.text.match(MARKER_PATTERN);
    if (marker && paragraph.text.startsWith(marker[0])) {
      notes.set(marker[0], cursor);
    }
  }
  return notes;
}
