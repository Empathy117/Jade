import { sourceIllustrationUrl } from "./data";
import type { Paragraph, SourceIllustration } from "./types";

interface NotePopoverProps {
  paragraph: Paragraph;
  /** Glyph or figure images the source anchors to this annotation. */
  illustrations: SourceIllustration[];
  bookPath: string;
  onClose: () => void;
}

/**
 * One annotation, shown in place without leaving the reading position.
 *
 * The paragraph is a `note` from the immutable source; the Reader only lends
 * it a stage. Tapping anywhere outside, Esc, or the close button puts it away.
 */
export function NotePopover({ paragraph, illustrations, bookPath, onClose }: NotePopoverProps) {
  return (
    <div
      className="note-backdrop"
      data-interactive="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="note-popover" role="dialog" aria-modal="true" aria-label="注释">
        <header className="note-popover__heading">
          <p>校注</p>
          <button type="button" aria-label="关闭注释" onClick={onClose}>×</button>
        </header>
        <div className="note-popover__body">
          {paragraph.text.split("\n").map((line, index) => (
            <p key={`${paragraph.id}-${index}`}>{line}</p>
          ))}
          {illustrations.map((illustration) => (
            <img
              key={illustration.id}
              src={sourceIllustrationUrl(bookPath, illustration)}
              alt={illustration.title ?? "注释附图"}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
        <footer className="note-popover__footer">点击空白处或按 Esc 返回正文</footer>
      </aside>
    </div>
  );
}
