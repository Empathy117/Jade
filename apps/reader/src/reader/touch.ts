/**
 * Interpret a completed touch gesture as page navigation.
 *
 * Swiping left (finger moves toward smaller x) reads as flipping forward, the
 * way a physical page turns; swiping right goes back. A gesture that is mostly
 * vertical belongs to the native reading scroll and must never turn the page,
 * so the horizontal component has to clearly dominate.
 */

export const SWIPE_MIN_DISTANCE = 56;
export const SWIPE_DOMINANCE = 1.5;
/** Travel past which a press is a drag (a selection sweep), never a tap. */
export const TAP_SLOP = 8;

export type SwipeAction = "next" | "previous";

/** Whether a press that travelled this far still reads as a tap. */
export function isTap(deltaX: number, deltaY: number, slop: number = TAP_SLOP): boolean {
  return Math.hypot(deltaX, deltaY) <= slop;
}

export function resolveSwipe(
  deltaX: number,
  deltaY: number,
  minDistance: number = SWIPE_MIN_DISTANCE,
): SwipeAction | null {
  if (Math.abs(deltaX) < minDistance) return null;
  if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_DOMINANCE) return null;
  return deltaX < 0 ? "next" : "previous";
}
