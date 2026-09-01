import { sourceIllustrationUrl } from "./data";
import { segmentMarkers } from "./notes";
import type { Paragraph, SourceIllustration } from "./types";

export interface VisibleReadingBeat {
  key: string;
  paragraph: Paragraph;
  beatIndex: number;
  beatCount: number;
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
  atEnd: boolean;
  viewportRef: React.RefObject<HTMLElement | null>;
  latestParagraphRef: React.RefObject<HTMLDivElement | null>;
  onOpenReference: (illustrationId: string) => void;
  onOpenNotes: (noteIndices: number[]) => void;
}

export function ReadingViewport({
  bookPath,
  beats,
  illustrationsByAnchor,
  referenceIllustrationIds,
  markerNotes,
  trailingNotes,
  atEnd,
  viewportRef,
  latestParagraphRef,
  onOpenReference,
  onOpenNotes,
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
          const trailing = beat.showIllustrations
            ? trailingNotes.get(paragraph.id) ?? []
            : [];
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
                {renderLines(paragraph, beat.markerOffset, markerNotes, onOpenNotes)}
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

/** Source line breaks are content, so they survive as `<br>` rather than wrapping. */
function renderLines(
  paragraph: Paragraph,
  markerOffset: number,
  markerNotes: Map<string, number[][]>,
  onOpenNotes: (noteIndices: number[]) => void,
) {
  const occurrences = markerNotes.get(paragraph.id);
  const lines = paragraph.text.split("\n");
  // Marker occurrences continue across the beat's lines, offset by the
  // markers that earlier beats of the same paragraph already showed.
  const counter = { next: markerOffset };
  return lines.map((line, lineIndex) => (
    <span key={`${paragraph.id}-${lineIndex}`}>
      {renderMarkers(line, `${paragraph.id}-${lineIndex}`, occurrences, counter, onOpenNotes)}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

/**
 * Scholarly markers like `[3]`, `〔一〕`, or `①` become tappable superscripts
 * when a note paragraph resolved to that occurrence; everything else is text.
 */
function renderMarkers(
  line: string,
  keyPrefix: string,
  occurrences: number[][] | undefined,
  counter: { next: number },
  onOpenNotes: (noteIndices: number[]) => void,
) {
  if (!occurrences) return line;
  return segmentMarkers(line).map((segment, segmentIndex) => {
    const key = `${keyPrefix}-${segmentIndex}`;
    if (segment.kind !== "marker") return <span key={key}>{segment.value}</span>;
    const notes = occurrences[counter.next];
    counter.next += 1;
    if (!notes || notes.length === 0) return <span key={key}>{segment.value}</span>;
    return (
      <button
        className="note-marker"
        type="button"
        data-interactive="true"
        key={key}
        aria-label={`查看注释 ${segment.value}`}
        onClick={() => onOpenNotes(notes)}
      >
        {segment.value}
      </button>
    );
  });
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
