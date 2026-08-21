import { sourceIllustrationUrl } from "./data";
import { segmentMarkers } from "./notes";
import type { Paragraph, SourceIllustration } from "./types";

interface ReadingViewportProps {
  bookPath: string;
  paragraphs: Paragraph[];
  illustrationsByAnchor: Map<string, SourceIllustration[]>;
  /** Illustrations the reader has unlocked in the guide gallery. */
  referenceIllustrationIds: Set<string>;
  /** Markers of the current chapter that resolve to an annotation. */
  noteMarkers: Map<string, number>;
  atEnd: boolean;
  viewportRef: React.RefObject<HTMLElement | null>;
  latestParagraphRef: React.RefObject<HTMLDivElement | null>;
  onOpenReference: (illustrationId: string) => void;
  onOpenNote: (marker: string) => void;
}

export function ReadingViewport({
  bookPath,
  paragraphs,
  illustrationsByAnchor,
  referenceIllustrationIds,
  noteMarkers,
  atEnd,
  viewportRef,
  latestParagraphRef,
  onOpenReference,
  onOpenNote,
}: ReadingViewportProps) {
  const lastOffset = paragraphs.length - 1;

  return (
    <section className="reading-viewport" aria-label="小说正文" ref={viewportRef}>
      <div className="paragraph-stack" aria-live="polite">
        {paragraphs.map((paragraph, offset) => {
          const isLatest = offset === lastOffset;
          return (
            <div
              className="reading-block"
              key={paragraph.id}
              ref={isLatest ? latestParagraphRef : undefined}
              data-paragraph-id={paragraph.id}
            >
              <div
                className={`paragraph paragraph--${paragraph.kind}${isLatest ? " is-current" : ""}`}
              >
                {renderLines(paragraph, noteMarkers, onOpenNote)}
              </div>
              {(illustrationsByAnchor.get(paragraph.id) ?? []).map((illustration) => (
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
  noteMarkers: Map<string, number>,
  onOpenNote: (marker: string) => void,
) {
  const lines = paragraph.text.split("\n");
  return lines.map((line, lineIndex) => (
    <span key={`${paragraph.id}-${lineIndex}`}>
      {renderMarkers(line, `${paragraph.id}-${lineIndex}`, noteMarkers, onOpenNote)}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

/**
 * Scholarly markers like `[3]` or `〔一〕` become tappable superscripts when
 * the current chapter carries a matching annotation; everything else is text.
 */
function renderMarkers(
  line: string,
  keyPrefix: string,
  noteMarkers: Map<string, number>,
  onOpenNote: (marker: string) => void,
) {
  if (noteMarkers.size === 0) return line;
  return segmentMarkers(line).map((segment, segmentIndex) => {
    const key = `${keyPrefix}-${segmentIndex}`;
    if (segment.kind === "marker" && noteMarkers.has(segment.value)) {
      return (
        <button
          className="note-marker"
          type="button"
          data-interactive="true"
          key={key}
          aria-label={`查看注释 ${segment.value}`}
          onClick={() => onOpenNote(segment.value)}
        >
          {segment.value}
        </button>
      );
    }
    return <span key={key}>{segment.value}</span>;
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
