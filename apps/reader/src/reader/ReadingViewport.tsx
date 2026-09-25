import type { ReactNode } from "react";

import type { PassageMark } from "./annotations";
import { sourceIllustrationUrl } from "./data";
import { segmentMarkers } from "./notes";
import type { Paragraph, SourceIllustration } from "./types";

export interface VisibleReadingBeat {
  key: string;
  paragraph: Paragraph;
  beatIndex: number;
  beatCount: number;
  /** Where this beat's text starts in the paragraph's displayed text. */
  textOffset: number;
  /** Markers in this paragraph's earlier beats; keys marker occurrences. */
  markerOffset: number;
  current: boolean;
  showIllustrations: boolean;
}

interface ReadingViewportProps {
  bookPath: string;
  beats: VisibleReadingBeat[];
  illustrationsByAnchor: Map<string, SourceIllustration[]>;
  /** Illustrations the reader has unlocked in the guide gallery. */
  referenceIllustrationIds: Set<string>;
  /** Note paragraphs behind each marker occurrence, per paragraph id. */
  markerNotes: Map<string, number[][]>;
  /** Notes without an in-text anchor; they surface from a paragraph chip. */
  trailingNotes: Map<string, number[]>;
  /** Paragraphs the reader has annotated as a whole. */
  annotatedIds: Set<string>;
  /** Passages the reader has annotated, per paragraph each piece falls in. */
  passageMarks: Map<string, PassageMark[]>;
  atEnd: boolean;
  viewportRef: React.RefObject<HTMLElement | null>;
  latestParagraphRef: React.RefObject<HTMLDivElement | null>;
  onOpenReference: (illustrationId: string) => void;
  onOpenNotes: (noteIndices: number[]) => void;
  onOpenAnnotation: (paragraphId: string) => void;
  onOpenPassageNote: (annotationId: string) => void;
}

const NO_MARKS: PassageMark[] = [];

export function ReadingViewport({
  bookPath,
  beats,
  illustrationsByAnchor,
  referenceIllustrationIds,
  markerNotes,
  trailingNotes,
  annotatedIds,
  passageMarks,
  atEnd,
  viewportRef,
  latestParagraphRef,
  onOpenReference,
  onOpenNotes,
  onOpenAnnotation,
  onOpenPassageNote,
}: ReadingViewportProps) {
  const hasSourceIllustration =
    beats.some(
      (beat) =>
        beat.showIllustrations &&
        (illustrationsByAnchor.get(beat.paragraph.id) ?? []).length > 0,
    );

  return (
    <section
      className={`reading-viewport${hasSourceIllustration ? " has-source-illustration" : ""}`}
      aria-label="小说正文"
      ref={viewportRef}
    >
      <div className="paragraph-stack" aria-live="polite">
        {beats.map((beat) => {
          const { paragraph } = beat;
          // The paragraph's closing beat carries its marginalia; while the
          // reader is inside the paragraph, the current beat stands in.
          const isClosingBeat = beat.current || beat.showIllustrations;
          const trailing = beat.showIllustrations
            ? trailingNotes.get(paragraph.id) ?? []
            : [];
          const hasAnnotation = annotatedIds.has(paragraph.id);
          return (
            <div
              className="reading-block"
              key={beat.key}
              ref={beat.current ? latestParagraphRef : undefined}
              data-paragraph-id={paragraph.id}
              data-reading-beat={`${beat.beatIndex + 1}/${beat.beatCount}`}
            >
              <div
                className={`paragraph paragraph--${paragraph.kind}${beat.current ? " is-current" : ""}`}
              >
                {renderBeatText(
                  beat,
                  markerNotes,
                  passageMarks.get(paragraph.id) ?? NO_MARKS,
                  onOpenNotes,
                  onOpenPassageNote,
                )}
                {trailing.length > 0 ? (
                  <button
                    className="paragraph-chip paragraph-chip--note"
                    type="button"
                    data-interactive="true"
                    aria-label="查看本段注释"
                    title="本段另有注释"
                    onClick={() => onOpenNotes(trailing)}
                  >
                    注
                  </button>
                ) : null}
                {isClosingBeat && hasAnnotation ? (
                  <button
                    className="paragraph-chip paragraph-chip--annotation is-filled"
                    type="button"
                    data-interactive="true"
                    aria-label="查看我的批注"
                    title="查看我的批注"
                    onClick={() => onOpenAnnotation(paragraph.id)}
                  >
                    批
                  </button>
                ) : null}
                {beat.current && !hasAnnotation ? (
                  <button
                    className="paragraph-chip paragraph-chip--annotation"
                    type="button"
                    data-interactive="true"
                    aria-label="为本段写批注"
                    title="为本段写批注"
                    onClick={() => onOpenAnnotation(paragraph.id)}
                  >
                    批
                  </button>
                ) : null}
              </div>
              {beat.current && beat.beatCount > 1 ? (
                <div
                  className="reading-beat-mark"
                  aria-label={`本段第 ${beat.beatIndex + 1} 页，共 ${beat.beatCount} 页`}
                >
                  {beat.beatIndex + 1} / {beat.beatCount}
                </div>
              ) : null}
              {(beat.showIllustrations ? illustrationsByAnchor.get(paragraph.id) ?? [] : []).map((illustration) => (
                <SourceIllustrationFigure
                  key={illustration.id}
                  bookPath={bookPath}
                  illustration={illustration}
                  isReference={referenceIllustrationIds.has(illustration.id)}
                  onOpenReference={onOpenReference}
                />
              ))}
            </div>
          );
        })}
        {atEnd ? <p className="end-mark">— 完 —</p> : null}
      </div>
    </section>
  );
}

/**
 * The beat's text as selectable runs, each stamped with its offset in the
 * paragraph's displayed text so a selection can be mapped back onto the
 * source. Source line breaks are content, so they survive as `<br>`;
 * scholarly markers become tappable superscripts; the reader's passage notes
 * underline their words and end in a chip.
 */
function renderBeatText(
  beat: VisibleReadingBeat,
  markerNotes: Map<string, number[][]>,
  marks: PassageMark[],
  onOpenNotes: (noteIndices: number[]) => void,
  onOpenPassageNote: (annotationId: string) => void,
) {
  const { paragraph } = beat;
  const occurrences = markerNotes.get(paragraph.id);
  const beatEnd = beat.textOffset + paragraph.text.length;
  const covering = marks.filter((mark) => mark.from < beatEnd && mark.to > beat.textOffset);
  const chips = covering
    .filter((mark) => mark.closes && mark.to <= beatEnd)
    .sort((a, b) => a.to - b.to);
  // Marker occurrences continue across the beat's lines, offset by the
  // markers that earlier beats of the same paragraph already showed.
  let nextMarker = beat.markerOffset;
  let lineStart = beat.textOffset;
  const lines = paragraph.text.split("\n");
  const rendered: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    const pieces: ReactNode[] = [];
    const placeChips = (through: number) => {
      while (chips.length > 0 && chips[0].to <= through) {
        const mark = chips.shift()!;
        pieces.push(
          <button
            className="passage-chip"
            type="button"
            data-interactive="true"
            key={`chip-${mark.annotationId}`}
            aria-label="查看这段文字的批注"
            title="查看批注"
            onClick={() => onOpenPassageNote(mark.annotationId)}
          >
            批
          </button>,
        );
      }
    };

    let cursor = lineStart;
    const segments = occurrences
      ? segmentMarkers(line)
      : [{ kind: "text" as const, value: line }];
    for (const segment of segments) {
      const from = cursor;
      cursor += segment.value.length;
      if (segment.kind === "marker") {
        const notes = occurrences?.[nextMarker];
        nextMarker += 1;
        if (notes && notes.length > 0) {
          pieces.push(
            <button
              className="note-marker"
              type="button"
              data-interactive="true"
              data-text-start={from}
              key={`marker-${from}`}
              aria-label={`查看注释 ${segment.value}`}
              onClick={() => onOpenNotes(notes)}
            >
              {segment.value}
            </button>,
          );
          placeChips(cursor);
          continue;
        }
      }
      for (const [start, end] of cutAtMarks(from, cursor, covering)) {
        const text = segment.value.slice(start - from, end - from);
        const marked = covering.some((mark) => mark.from <= start && mark.to >= end);
        pieces.push(
          marked ? (
            <mark className="passage-mark" data-text-start={start} key={`text-${start}`}>
              {text}
            </mark>
          ) : (
            <span data-text-start={start} key={`text-${start}`}>
              {text}
            </span>
          ),
        );
        placeChips(end);
      }
    }
    // A passage that ends on this line's break still closes on this line.
    const isLastLine = lineIndex === lines.length - 1;
    placeChips(isLastLine ? beatEnd : cursor + 1);
    rendered.push(
      <span key={`${paragraph.id}-${lineIndex}`}>
        {pieces}
        {isLastLine ? null : <br />}
      </span>,
    );
    lineStart = cursor + 1;
  });
  return rendered;
}

/** Split `[from, to)` wherever a passage mark begins or ends inside it. */
function cutAtMarks(from: number, to: number, marks: PassageMark[]): Array<[number, number]> {
  const cuts = new Set([from, to]);
  for (const mark of marks) {
    if (mark.from > from && mark.from < to) cuts.add(mark.from);
    if (mark.to > from && mark.to < to) cuts.add(mark.to);
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  return sorted.slice(1).map((end, index): [number, number] => [sorted[index], end]);
}

function SourceIllustrationFigure({
  bookPath,
  illustration,
  isReference,
  onOpenReference,
}: {
  bookPath: string;
  illustration: SourceIllustration;
  isReference: boolean;
  onOpenReference: (illustrationId: string) => void;
}) {
  const image = (
    <img
      src={sourceIllustrationUrl(bookPath, illustration)}
      alt={illustration.title ?? "原书插图"}
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <figure className="source-illustration">
      {isReference ? (
        <button
          type="button"
          data-interactive="true"
          aria-label={`在资料图册中查看${illustration.title ?? "这张插图"}`}
          onClick={() => onOpenReference(illustration.id)}
        >
          {image}
        </button>
      ) : (
        image
      )}
      {illustration.title ? <figcaption>{illustration.title}</figcaption> : null}
    </figure>
  );
}
