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
 * Note markers as the source editions print them: sequential arabic
 * annotations `[1]`, 校记 counters in CJK brackets `〔一〕`, and the circled
 * numerals `①` that popular translated editions restart on every print page.
 */
const CIRCLED_CLASS = "\\u2460-\\u2473\\u3251-\\u325f\\u32b1-\\u32bf";
const MARKER_PATTERN = new RegExp(
  `\\[\\d+\\]|〔[一二三四五六七八九十〇○百]+〕|[${CIRCLED_CLASS}]`,
  "g",
);

/**
 * A circled marker often reaches us as its own source line (`…拟黄鹂\n①\n、…`)
 * because the print superscript was a separate EPUB element. The line breaks
 * are typography, not content: fold them so the marker sits inline where the
 * print edition had it. Bracket markers never carry such breaks.
 */
const CIRCLED_BREAK_PATTERN = new RegExp(`\\n?([${CIRCLED_CLASS}])\\n?`, "g");

export function normalizeMarkerBreaks(text: string): string {
  return text.replace(CIRCLED_BREAK_PATTERN, "$1");
}

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

/** How many markers `text` contains; positions beats inside a paragraph. */
export function countMarkers(text: string): number {
  return [...text.matchAll(MARKER_PATTERN)].length;
}

/**
 * Where every annotation of the book surfaces.
 *
 * `markers` maps a paragraph id to one entry per marker occurrence in its
 * text, each holding the note paragraphs that occurrence opens (empty when the
 * occurrence resolved to nothing — front-matter noise stays plain text).
 * `trailing` collects notes that lost their in-text anchor; they surface from
 * a chip at the end of the paragraph they follow.
 */
export interface NoteAnchors {
  markers: Map<string, number[][]>;
  trailing: Map<string, number[]>;
}

export const EMPTY_NOTE_ANCHORS: NoteAnchors = {
  markers: new Map(),
  trailing: new Map(),
};

type MarkerFamily = "arabic" | "cjk" | "circled";

function markerFamily(marker: string): MarkerFamily {
  if (marker.startsWith("[")) return "arabic";
  if (marker.startsWith("〔")) return "cjk";
  return "circled";
}

function leadingMarker(text: string): string | null {
  MARKER_PATTERN.lastIndex = 0;
  const match = MARKER_PATTERN.exec(text);
  return match && match.index === 0 ? match[0] : null;
}

interface MarkerOccurrence {
  family: MarkerFamily;
  value: string;
  claimed: boolean;
  /** The occurrence's note list inside `markers`; claiming fills it. */
  notes: number[];
}

/**
 * Pair every note paragraph with the in-text marker it belongs to.
 *
 * Editions differ: 红研所-style books number `[1]`…`[n]` uniquely per chapter
 * and print the notes after it, while popular translations restart `①` on
 * every print page and interleave the notes directly after their paragraph —
 * so a chapter sees many identical `①` and marker values alone cannot pair.
 * Occurrences are therefore claimed per run of consecutive notes: when a run
 * carries exactly as many notes of a marker family as that family has open
 * occurrences, they pair in order (which also absorbs the odd misprinted
 * number); otherwise each note claims its printed value. A note that opens
 * without a marker continues the note above it, and one nothing claims falls
 * back to the paragraph it follows. Chapter headings reset the open set, so a
 * stray `①` on a copyright page can never steal a chapter's first note.
 */
export function resolveNoteAnchors(paragraphs: Paragraph[]): NoteAnchors {
  const markers = new Map<string, number[][]>();
  const trailing = new Map<string, number[]>();
  let open: MarkerOccurrence[] = [];
  let run: number[] = [];
  let runAnchor = -1;

  const trailingListFor = (anchorIndex: number): number[] => {
    if (anchorIndex < 0) return [];
    const id = paragraphs[anchorIndex].id;
    const existing = trailing.get(id);
    if (existing) return existing;
    const created: number[] = [];
    trailing.set(id, created);
    return created;
  };

  const resolveRun = () => {
    if (run.length === 0) return;
    const targets = new Array<number[] | null>(run.length).fill(null);
    const leads = run.map((noteIndex) => leadingMarker(paragraphs[noteIndex].text));

    for (const family of ["arabic", "cjk", "circled"] as const) {
      const notePositions = run
        .map((_, position) => position)
        .filter((position) => leads[position] !== null && markerFamily(leads[position]!) === family);
      const occurrences = open.filter(
        (occurrence) => !occurrence.claimed && occurrence.family === family,
      );
      if (notePositions.length === 0) continue;
      if (notePositions.length === occurrences.length) {
        // Counts agree: this run annotates exactly the open markers, so pair
        // them in order even where the printed numbers disagree.
        notePositions.forEach((position, pairIndex) => {
          occurrences[pairIndex].claimed = true;
          targets[position] = occurrences[pairIndex].notes;
        });
        continue;
      }
      for (const position of notePositions) {
        const match = occurrences.find(
          (occurrence) => !occurrence.claimed && occurrence.value === leads[position],
        );
        if (match) {
          match.claimed = true;
          targets[position] = match.notes;
        } else {
          targets[position] = trailingListFor(runAnchor);
        }
      }
    }

    for (let position = 0; position < run.length; position += 1) {
      if (leads[position] === null) {
        if (position > 0) {
          targets[position] = targets[position - 1];
        } else {
          const first = open.find((occurrence) => !occurrence.claimed);
          if (first) {
            first.claimed = true;
            targets[position] = first.notes;
          } else {
            targets[position] = trailingListFor(runAnchor);
          }
        }
      }
      targets[position]?.push(run[position]);
    }
    run = [];
  };

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    if (paragraph.kind === "note") {
      run.push(index);
      continue;
    }
    resolveRun();
    if (paragraph.kind === "chapter_heading") open = [];
    if (isFlowParagraph(paragraph)) {
      runAnchor = index;
      const occurrences: number[][] = [];
      MARKER_PATTERN.lastIndex = 0;
      for (const match of paragraph.text.matchAll(MARKER_PATTERN)) {
        const notes: number[] = [];
        occurrences.push(notes);
        open.push({
          family: markerFamily(match[0]),
          value: match[0],
          claimed: false,
          notes,
        });
      }
      if (occurrences.length > 0) markers.set(paragraph.id, occurrences);
    }
  }
  resolveRun();

  for (const [id, list] of trailing) {
    if (list.length === 0) trailing.delete(id);
  }
  return { markers, trailing };
}
