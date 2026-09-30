/**
 * Small helpers for the quiet material the Runtime's hand-drawn devices
 * carry: a seeded random source, so a texture is the same on every reading,
 * and offscreen canvases to draw it into once.
 */

/** A seeded pseudo-random source (mulberry32) returning numbers in [0, 1). */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An offscreen canvas `width` × `height` drawing units at `res` pixels per
 * unit, with its context scaled to drawing units; null where there is no 2D
 * context (jsdom).
 */
export function offscreen(
  width: number,
  height: number,
  res: number,
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * res);
  canvas.height = Math.ceil(height * res);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(res, res);
  return { canvas, context };
}
