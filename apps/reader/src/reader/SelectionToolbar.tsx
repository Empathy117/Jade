import { useState } from "react";
import type { RefObject } from "react";

import { passageAnnotationId } from "./annotations";
import type { PassageRange } from "./annotations";
import type { ParagraphPositions } from "./readerState";
import type { Paragraph } from "./types";
import { usePassageSelection } from "./usePassageSelection";
import type { ToolbarPlacement } from "./usePassageSelection";

interface PassageSelectionToolbarProps {
  viewportRef: RefObject<HTMLElement | null>;
  /** Reading, with nothing modal laid over the text. */
  enabled: boolean;
  paragraphs: Paragraph[];
  positions: ParagraphPositions;
  onAnnotate: (range: PassageRange) => void;
  /** Resolves true once the passage is on the clipboard. */
  onCopy: (range: PassageRange) => Promise<boolean>;
}

/**
 * Actions for a passage the reader selected, floated beside the selection.
 *
 * The selection is tracked here rather than in the reader, so sweeping,
 * scrolling, and reflow move only this toolbar and never re-render the text.
 */
export function PassageSelectionToolbar({
  viewportRef,
  enabled,
  paragraphs,
  positions,
  onAnnotate,
  onCopy,
}: PassageSelectionToolbarProps) {
  const { selection, clear } = usePassageSelection(viewportRef, enabled, paragraphs, positions);
  if (!selection) return null;
  const { range } = selection;
  return (
    <SelectionToolbar
      key={passageAnnotationId(range)}
      placement={selection.placement}
      onAnnotate={() => {
        clear();
        onAnnotate(range);
      }}
      onCopy={() => onCopy(range)}
    />
  );
}

/**
 * A press here must not collapse the selection it acts on or pull focus from
 * the page, so the toolbar swallows the pointer-down before the browser can.
 */
function SelectionToolbar({
  placement,
  onAnnotate,
  onCopy,
}: {
  placement: ToolbarPlacement | null;
  onAnnotate: () => void;
  onCopy: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const position = placement === null ? " is-docked" : placement.below ? " is-below" : "";

  return (
    <div
      className={`selection-toolbar${position}`}
      role="toolbar"
      aria-label="选中的文字"
      data-interactive="true"
      data-selection-toolbar="true"
      style={placement ? { left: placement.x, top: placement.y } : undefined}
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button type="button" data-interactive="true" onClick={onAnnotate}>
        批注
      </button>
      <span className="selection-toolbar__divider" aria-hidden="true" />
      <button
        type="button"
        data-interactive="true"
        onClick={() => {
          void onCopy().then(setCopied);
        }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}
