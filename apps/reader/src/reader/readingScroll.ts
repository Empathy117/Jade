const BOTTOM_SAFE_RATIO = 0.22;
const MIN_BOTTOM_SAFE_INSET = 96;
const MAX_BOTTOM_SAFE_INSET = 280;

export function readingBottomSafeInset(viewportHeight: number): number {
  return Math.min(
    MAX_BOTTOM_SAFE_INSET,
    Math.max(MIN_BOTTOM_SAFE_INSET, viewportHeight * BOTTOM_SAFE_RATIO),
  );
}

export function calculateReadingScrollDelta(
  viewportTop: number,
  viewportHeight: number,
  paragraphBottom: number,
): number {
  const safeBottom =
    viewportTop + viewportHeight - readingBottomSafeInset(viewportHeight);
  return Math.max(0, paragraphBottom - safeBottom);
}

/**
 * Smooth only for short advances. A resume or jump can put the reading
 * position a whole scene below the fold, and Chrome silently drops smooth
 * scrolls over such distances — those land instantly instead.
 */
export function readingScrollBehavior(
  delta: number,
  viewportHeight: number,
  reducedMotion: boolean,
): ScrollBehavior {
  return reducedMotion || delta > viewportHeight ? "auto" : "smooth";
}

/**
 * Keep the newly revealed beat readable while leaving all earlier beats in the
 * same scene above it for native upward scrolling.
 */
export function keepParagraphAboveBottomFade(
  viewport: HTMLElement,
  paragraph: HTMLElement,
  reducedMotion: boolean,
): void {
  const viewportRect = viewport.getBoundingClientRect();
  const paragraphRect = paragraph.getBoundingClientRect();
  const top = calculateReadingScrollDelta(
    viewportRect.top,
    viewportRect.height,
    paragraphRect.bottom,
  );

  if (top < 1) return;

  viewport.scrollBy({
    top,
    behavior: readingScrollBehavior(top, viewportRect.height, reducedMotion),
  });
}
