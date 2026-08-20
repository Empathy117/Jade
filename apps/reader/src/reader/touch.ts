/**
 * Interpret a completed touch gesture as page navigation.
 *
 * Swiping left (finger moves toward smaller x) reads as flipping forward, the
 * way a physical page turns; swiping right goes back. A gesture that is mostly
 * vertical is scrolling and must never turn the page, so the horizontal
 * component has to clearly dominate.
 */

export const SWIPE_MIN_DISTANCE = 56;
export const SWIPE_DOMINANCE = 1.5;

export type SwipeAction = "next" | "previous";

export function resolveSwipe(
  deltaX: number,
  deltaY: number,
  minDistance: number = SWIPE_MIN_DISTANCE,
): SwipeAction | null {
  if (Math.abs(deltaX) < minDistance) return null;
  if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_DOMINANCE) return null;
  return deltaX < 0 ? "next" : "previous";
}
