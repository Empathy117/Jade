/** What every instrument face needs to follow the reading (ADR-0006). */
export interface FaceProps {
  stepped: boolean;
  reducedMotion: boolean;
  reactive: boolean;
  visible: boolean;
}

/**
 * Size a face's canvas for the screen's pixel density and map its drawing
 * space, `width` units across, onto it. Returns null where there is no 2D
 * context (jsdom) or nothing to draw on yet.
 */
export function prepareCanvas(canvas: HTMLCanvasElement | null, width: number): CanvasRenderingContext2D | null {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return null;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(canvas.clientWidth * ratio);
  const pixelHeight = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const scale = canvas.width / width;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return context;
}

/** Ease out: fast start, gentle landing. */
export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

/** Ease in and out, for something lifted and set down. */
export function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}
