import { sourceIllustrationUrl } from "./data";
import type { Paragraph, SourceIllustration } from "./types";

interface ReadingViewportProps {
  bookPath: string;
  paragraphs: Paragraph[];
  illustrationsByAnchor: Map<string, SourceIllustration[]>;
  /** Illustrations the reader has unlocked in the guide gallery. */
  referenceIllustrationIds: Set<string>;
  atEnd: boolean;
  viewportRef: React.RefObject<HTMLElement | null>;
  latestParagraphRef: React.RefObject<HTMLDivElement | null>;
  onOpenReference: (illustrationId: string) => void;
}

export function ReadingViewport({
  bookPath,
  paragraphs,
  illustrationsByAnchor,
  referenceIllustrationIds,
  atEnd,
  viewportRef,
  latestParagraphRef,
  onOpenReference,
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
                {renderLines(paragraph)}
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
function renderLines(paragraph: Paragraph) {
  const lines = paragraph.text.split("\n");
  return lines.map((line, lineIndex) => (
    <span key={`${paragraph.id}-${lineIndex}`}>
      {line}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </span>
  ));
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
