import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

import type { PassageRange } from "./annotations";
import { resolvePassage } from "./passageSelection";
import type { ParagraphPositions } from "./readerState";
import type { Paragraph } from "./types";

/** Where the selection toolbar floats, in viewport pixels. */
export interface ToolbarPlacement {
  /** Horizontal centre. */
  x: number;
  /** The toolbar's bottom edge when above the selection, its top edge when below. */
  y: number;
  below: boolean;
}

export interface PassageSelection {
  range: PassageRange;
  /** Null docks the toolbar: the selection is off screen or cannot be measured. */
  placement: ToolbarPlacement | null;
}

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const TOOLBAR_HEIGHT = 40;
const TOOLBAR_GAP = 10;
const TOOLBAR_HALF_WIDTH = 76;
const SIDE_MARGIN = 10;
/** Let a selection stop changing before offering actions for it. */
const SETTLE_MS = 90;

/**
 * Centre the toolbar over the visible part of the selection, or under it when
 * the viewport leaves no room above. Touch platforms draw their own callout
 * above a selection, so there the toolbar prefers to sit below.
 */
export function placeSelectionToolbar(
  selection: Box,
  frame: Box,
  windowWidth: number,
  preferBelow: boolean,
): ToolbarPlacement | null {
  const top = Math.max(selection.top, frame.top);
  const bottom = Math.min(selection.bottom, frame.bottom);
  if (bottom <= top) return null;
  const needed = TOOLBAR_GAP + TOOLBAR_HEIGHT;
  const roomAbove = top - frame.top;
  const roomBelow = frame.bottom - bottom;
  const below = preferBelow
    ? roomBelow >= needed || roomBelow >= roomAbove
    : roomAbove < needed && roomBelow > roomAbove;
  const centre = (selection.left + selection.right) / 2;
  const x = Math.min(
    Math.max(centre, SIDE_MARGIN + TOOLBAR_HALF_WIDTH),
    windowWidth - SIDE_MARGIN - TOOLBAR_HALF_WIDTH,
  );
  return { x, y: below ? bottom + TOOLBAR_GAP : top - TOOLBAR_GAP, below };
}

function placementOf(range: Range, viewport: HTMLElement): ToolbarPlacement | null {
  // Only a laid-out page can measure a range; jsdom, for one, cannot.
  if (typeof range.getBoundingClientRect !== "function") return null;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return placeSelectionToolbar(
    range.getBoundingClientRect(),
    viewport.getBoundingClientRect(),
    window.innerWidth,
    coarse,
  );
}

/**
 * The passage the reader has selected in the reading viewport, if any.
 *
 * Nothing is offered mid-sweep: the toolbar waits for the pointer to lift or
 * the selection to hold still, then follows the selection as the text
 * scrolls or reflows. A press on the toolbar itself leaves it be, so its
 * buttons act on the selection they were shown for.
 */
export function usePassageSelection(
  viewportRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  paragraphs: Paragraph[],
  positions: ParagraphPositions,
): { selection: PassageSelection | null; clear: () => void } {
  const [selection, setSelection] = useState<PassageSelection | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!enabled || !viewport) return;

    let pressed = false;
    let toolbarPress = false;
    let showing = false;
    let timer = 0;
    let frame = 0;

    const read = (): PassageSelection | null => {
      const live = window.getSelection();
      if (!live || live.isCollapsed || live.rangeCount === 0) return null;
      const range = live.getRangeAt(0);
      // A sweep can overshoot onto the header or footer; only its text counts.
      if (!range.intersectsNode(viewport)) return null;
      const passage = resolvePassage(viewport, range, paragraphs, positions);
      return passage ? { range: passage, placement: placementOf(range, viewport) } : null;
    };

    const show = (next: PassageSelection | null) => {
      showing = next !== null;
      setSelection(next);
    };

    const settleAfter = (delay: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => show(read()), delay);
    };

    const onSelectionChange = () => {
      if (toolbarPress) return;
      if (pressed) {
        window.clearTimeout(timer);
        if (showing) show(null);
        return;
      }
      settleAfter(SETTLE_MS);
    };

    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest("[data-selection-toolbar]")) {
        toolbarPress = true;
        return;
      }
      pressed = true;
    };

    const onPointerUp = () => {
      if (toolbarPress) {
        toolbarPress = false;
        return;
      }
      if (!pressed) return;
      pressed = false;
      settleAfter(0);
    };

    const onReflow = () => {
      if (!showing || frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        show(read());
      });
    };

    // New beats grow the column without scrolling it, which moves the text.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(onReflow) : null;
    if (observer && viewport.firstElementChild) observer.observe(viewport.firstElementChild);

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    viewport.addEventListener("scroll", onReflow, { passive: true });
    window.addEventListener("resize", onReflow);
    // A selection can outlive a panel that was opened over it.
    settleAfter(0);

    return () => {
      window.clearTimeout(timer);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      viewport.removeEventListener("scroll", onReflow);
      window.removeEventListener("resize", onReflow);
      setSelection(null);
    };
  }, [enabled, paragraphs, positions, viewportRef]);

  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  return { selection: enabled ? selection : null, clear };
}
