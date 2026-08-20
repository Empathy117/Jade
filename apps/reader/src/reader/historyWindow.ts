/**
 * The slice of already-read paragraphs the history panel renders.
 *
 * A finished novel can leave tens of thousands of paragraphs behind the reader,
 * and every history entry is a focusable button. Rendering the whole backlog at
 * once costs a visible stall on open, so the panel shows a window around the
 * reading position and grows it on demand.
 */

export const HISTORY_WINDOW_RADIUS = 120;

export interface HistoryWindow {
  start: number;
  end: number;
}

export type HistoryWindowEdge = "earlier" | "later";

/**
 * A window centred on `currentIndex`, keeping its full size near either end of
 * the range by shifting rather than shrinking.
 */
export function historyWindowAround(
  firstIndex: number,
  furthestReadIndex: number,
  currentIndex: number,
  radius: number = HISTORY_WINDOW_RADIUS,
): HistoryWindow {
  if (furthestReadIndex < firstIndex) {
    return { start: firstIndex, end: firstIndex };
  }

  const centre = Math.min(Math.max(currentIndex, firstIndex), furthestReadIndex);
  let start = centre - radius;
  let end = centre + radius;

  if (start < firstIndex) {
    end += firstIndex - start;
    start = firstIndex;
  }
  if (end > furthestReadIndex) {
    start -= end - furthestReadIndex;
    end = furthestReadIndex;
  }

  return {
    start: Math.max(firstIndex, start),
    end: Math.min(furthestReadIndex, end),
  };
}

export function expandHistoryWindow(
  window: HistoryWindow,
  edge: HistoryWindowEdge,
  firstIndex: number,
  furthestReadIndex: number,
  step: number = HISTORY_WINDOW_RADIUS,
): HistoryWindow {
  return edge === "earlier"
    ? { start: Math.max(firstIndex, window.start - step), end: window.end }
    : { start: window.start, end: Math.min(furthestReadIndex, window.end + step) };
}
