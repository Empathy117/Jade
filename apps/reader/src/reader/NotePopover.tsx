import { sourceIllustrationUrl } from "./data";
import type { Paragraph, SourceIllustration } from "./types";

interface NotePopoverProps {
  /** The `note` paragraphs one anchor opens — usually one, sometimes a group. */
  notes: Paragraph[];
  /** Glyph or figure images the source anchors to these annotations. */
  illustrationsByAnchor: Map<string, SourceIllustration[]>;
  bookPath: string;
  onClose: () => void;
}

/**
 * The annotations behind one marker, shown without leaving the reading position.
 *
 * The paragraphs are `note`s from the immutable source; the Reader only lends
 * them a stage. Tapping anywhere outside, Esc, or the close button puts it away.
 */
export function NotePopover({ notes, illustrationsByAnchor, bookPath, onClose }: NotePopoverProps) {
  const label = notes.some((note) => /^[[〔]/.test(note.text)) ? "校注" : "注释";
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
          <p>{label}</p>
          <button type="button" aria-label="关闭注释" onClick={onClose}>×</button>
        </header>
        <div className="note-popover__body">
          {notes.map((note) => (
            <div className="note-popover__entry" key={note.id}>
              {note.text.split("\n").map((line, index) => (
                <p key={`${note.id}-${index}`}>{line}</p>
              ))}
              {(illustrationsByAnchor.get(note.id) ?? []).map((illustration) => (
                <img
                  key={illustration.id}
                  src={sourceIllustrationUrl(bookPath, illustration)}
                  alt={illustration.title ?? "注释附图"}
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </div>
          ))}
        </div>
        <footer className="note-popover__footer">点击空白处或按 Esc 返回正文</footer>
      </aside>
    </div>
  );
}
