/**
 * Reader-written margin notes, in the reader's own words.
 *
 * A note belongs either to a whole paragraph, stored under that paragraph's
 * id, or to a passage the reader selected, anchored at both ends by paragraph
 * id and character offset. The immutable source stays untouched: annotations
 * live beside the book in local storage and never outlive the revision whose
 * paragraph ids they reference.
 */

import { isFlowParagraph, normalizeMarkerBreaks } from "./notes";
import type { ParagraphPositions } from "./readerState";
import type { Paragraph } from "./types";

/**
 * A point in a paragraph's displayed text — the text reading beats split, with
 * circled-marker breaks folded — counted in UTF-16 code units.
 */
export interface TextAnchor {
  paragraphId: string;
  offset: number;
}

/** A selected passage; `start` comes before `end` in reading order. */
export interface PassageRange {
  start: TextAnchor;
  end: TextAnchor;
}

export interface Annotation {
  /** The paragraph id of a paragraph note; `passageAnnotationId` of a passage note. */
  id: string;
  text: string;
  updatedAt: number;
  /** The passage the note was written against; absent on paragraph notes. */
  range?: PassageRange;
}

/** What a note is (or will be) written against, before any text exists. */
export interface AnnotationTarget {
  id: string;
  range?: PassageRange;
}

export function annotationsStorageKey(bookId: string, sourceRevision: number): string {
  return `immersive-reader:${bookId}:annotations:revision-${sourceRevision}`;
}

/**
 * One note per passage: selecting exactly the same words again reopens it.
 *
 * Paragraph ids are `p` and digits, so these keys never collide with the
 * paragraph notes stored alongside them.
 */
export function passageAnnotationId(range: PassageRange): string {
  const { start, end } = range;
  return `${start.paragraphId}:${start.offset}-${end.paragraphId}:${end.offset}`;
}

/** The paragraph a note is listed under and jumps to. */
export function annotationAnchorId(annotation: AnnotationTarget): string {
  return annotation.range?.start.paragraphId ?? annotation.id;
}

function isTextAnchor(value: unknown): value is TextAnchor {
  if (typeof value !== "object" || value === null) return false;
  const anchor = value as TextAnchor;
  return (
    typeof anchor.paragraphId === "string" &&
    Number.isInteger(anchor.offset) &&
    anchor.offset >= 0
  );
}

function isAnnotation(entry: unknown): entry is Annotation {
  if (typeof entry !== "object" || entry === null) return false;
  const annotation = entry as Annotation;
  if (
    typeof annotation.id !== "string" ||
    typeof annotation.text !== "string" ||
    typeof annotation.updatedAt !== "number"
  ) {
    return false;
  }
  if (annotation.range === undefined) return true;
  const range = annotation.range as unknown;
  return (
    typeof range === "object" &&
    range !== null &&
    isTextAnchor((range as PassageRange).start) &&
    isTextAnchor((range as PassageRange).end)
  );
}

/** Parse saved annotations, discarding anything that is not the expected shape. */
export function parseAnnotations(saved: string | null): Annotation[] {
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAnnotation);
  } catch {
    return [];
  }
}

export function annotationFor(
  annotations: Annotation[],
  id: string,
): Annotation | null {
  return annotations.find((annotation) => annotation.id === id) ?? null;
}

/**
 * Write the note stored under `id`; empty text removes it.
 *
 * `range` anchors a new passage note; an existing note keeps its own. Order
 * is kept stable so the annotations list does not reshuffle on edit.
 */
export function upsertAnnotation(
  annotations: Annotation[],
  id: string,
  text: string,
  updatedAt: number,
  range?: PassageRange,
): Annotation[] {
  const trimmed = text.trim();
  if (!trimmed) return annotations.filter((annotation) => annotation.id !== id);
  if (!annotationFor(annotations, id)) {
    return [...annotations, { id, text: trimmed, updatedAt, ...(range ? { range } : {}) }];
  }
  return annotations.map((annotation) =>
    annotation.id === id ? { ...annotation, text: trimmed, updatedAt } : annotation,
  );
}

/** A paragraph's displayed text: the coordinate space of every `TextAnchor`. */
export function displayedText(paragraph: Paragraph): string {
  return normalizeMarkerBreaks(paragraph.text);
}

interface PassageSpan {
  index: number;
  text: string;
  from: number;
  to: number;
}

/**
 * Each flow paragraph a passage touches, with the part of it the passage covers.
 *
 * Apparatus paragraphs between the ends (notes, print navigation) never enter
 * the reading flow, so a passage skips them just as the reader did.
 */
function passageSpans(
  range: PassageRange,
  paragraphs: Paragraph[],
  positions: ParagraphPositions,
): PassageSpan[] {
  const first = positions.get(range.start.paragraphId);
  const last = positions.get(range.end.paragraphId);
  if (first === undefined || last === undefined || last < first) return [];
  const spans: PassageSpan[] = [];
  for (let index = first; index <= last; index += 1) {
    const paragraph = paragraphs[index];
    if (!isFlowParagraph(paragraph)) continue;
    const text = displayedText(paragraph);
    const from = index === first ? Math.min(range.start.offset, text.length) : 0;
    const to = index === last ? Math.min(range.end.offset, text.length) : text.length;
    if (to > from) spans.push({ index, text, from, to });
  }
  return spans;
}

/** The passage's words exactly as the source has them; paragraphs join with a line break. */
export function passageQuote(
  range: PassageRange,
  paragraphs: Paragraph[],
  positions: ParagraphPositions,
): string {
  return passageSpans(range, paragraphs, positions)
    .map((span) => span.text.slice(span.from, span.to))
    .join("\n");
}

export interface PassageMark {
  annotationId: string;
  /** The covered span of this paragraph's displayed text. */
  from: number;
  to: number;
  /** The passage ends here, so its note chip follows `to`. */
  closes: boolean;
}

/** Passage-note highlights, keyed by the paragraph each piece falls in. */
export function passageMarks(
  annotations: Annotation[],
  paragraphs: Paragraph[],
  positions: ParagraphPositions,
): Map<string, PassageMark[]> {
  const marks = new Map<string, PassageMark[]>();
  for (const annotation of annotations) {
    if (!annotation.range) continue;
    const spans = passageSpans(annotation.range, paragraphs, positions);
    spans.forEach((span, position) => {
      const paragraphId = paragraphs[span.index].id;
      const list = marks.get(paragraphId) ?? [];
      list.push({
        annotationId: annotation.id,
        from: span.from,
        to: span.to,
        closes: position === spans.length - 1,
      });
      marks.set(paragraphId, list);
    });
  }
  return marks;
}

/** One line of text: line breaks folded, clipped with an ellipsis. */
export function clipText(text: string, limit: number): string {
  const line = text.replace(/\n/g, " ");
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}

/**
 * What a note is about, in one line: the passage in 「」, or the opening of
 * the paragraph. Null when the anchor is not in this revision of the book.
 */
export function annotationExcerpt(
  target: AnnotationTarget,
  paragraphs: Paragraph[],
  positions: ParagraphPositions,
  limit: number,
): string | null {
  if (target.range) {
    if (!positions.has(target.range.start.paragraphId)) return null;
    return `「${clipText(passageQuote(target.range, paragraphs, positions), limit)}」`;
  }
  const index = positions.get(target.id);
  return index === undefined ? null : clipText(displayedText(paragraphs[index]), limit);
}

export interface AnnotationListing {
  id: string;
  /** Paragraph the note jumps to. */
  index: number;
  note: string;
  excerpt: string;
  updatedAt: number;
}

/** Every note in reading order; a paragraph's own note leads its passage notes. */
export function listAnnotations(
  annotations: Annotation[],
  paragraphs: Paragraph[],
  positions: ParagraphPositions,
  excerptLength = 52,
): AnnotationListing[] {
  const rows: Array<{ row: AnnotationListing; offset: number }> = [];
  for (const annotation of annotations) {
    const index = positions.get(annotationAnchorId(annotation));
    const excerpt = annotationExcerpt(annotation, paragraphs, positions, excerptLength);
    if (index === undefined || excerpt === null) continue;
    rows.push({
      row: {
        id: annotation.id,
        index,
        note: annotation.text,
        excerpt,
        updatedAt: annotation.updatedAt,
      },
      offset: annotation.range?.start.offset ?? -1,
    });
  }
  rows.sort((a, b) => a.row.index - b.row.index || a.offset - b.offset);
  return rows.map(({ row }) => row);
}
