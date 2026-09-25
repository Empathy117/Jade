import { useEffect, useRef, useState } from "react";

interface AnnotationEditorProps {
  /** One line naming what the note is about: a quoted passage or a paragraph's opening. */
  excerpt: string | null;
  /** The saved annotation text, or empty when writing a fresh one. */
  initialText: string;
  onSave: (text: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * Write or revise the margin note of one paragraph or selected passage.
 *
 * Save keeps it, an emptied text (or 删除) removes it, and Esc or the
 * backdrop leaves the saved note untouched.
 */
export function AnnotationEditor({
  excerpt,
  initialText,
  onSave,
  onRemove,
  onClose,
}: AnnotationEditorProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasSaved = initialText.trim().length > 0;

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div
      className="note-backdrop"
      data-interactive="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="note-popover annotation-editor"
        role="dialog"
        aria-modal="true"
        aria-label="批注"
      >
        <header className="note-popover__heading">
          <p>批注</p>
          <button type="button" aria-label="关闭批注" onClick={onClose}>×</button>
        </header>
        <div className="note-popover__body">
          {excerpt ? <p className="annotation-editor__source">{excerpt}</p> : null}
          <textarea
            ref={textareaRef}
            className="annotation-editor__input"
            value={text}
            rows={4}
            placeholder="写点什么，只留给自己看…"
            aria-label="批注内容"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onSave(text);
              }
            }}
          />
        </div>
        <footer className="note-popover__footer annotation-editor__actions">
          {hasSaved ? (
            <button
              className="annotation-editor__remove"
              type="button"
              onClick={onRemove}
            >
              删除
            </button>
          ) : (
            <span />
          )}
          <button
            className="annotation-editor__save"
            type="button"
            disabled={!text.trim() && !hasSaved}
            onClick={() => onSave(text)}
          >
            保存
          </button>
        </footer>
      </aside>
    </div>
  );
}
