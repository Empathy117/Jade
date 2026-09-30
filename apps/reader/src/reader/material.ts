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

/**
 * Paper: the flat colour with a faint fibrous grain and a soft warm light
 * along the top and left edges, as if a lamp stood to the upper left. Drawn
 * over `width` × `height` drawing units from the context's origin.
 */
export function paintPaper(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  colour: string,
  seed: number,
  light = 1,
) {
  context.fillStyle = colour;
  context.fillRect(0, 0, width, height);
  const random = seeded(seed);
  // Short fibres lying every which way, lighter and darker than the sheet.
  context.lineWidth = 0.18;
  const fibres = Math.round(width * height * 0.09);
  for (let fibre = 0; fibre < fibres; fibre += 1) {
    const x = random() * width;
    const y = random() * height;
    const angle = random() * Math.PI;
    const length = 0.6 + random() * 1.8;
    context.strokeStyle = random() < 0.55 ? "rgba(120, 96, 60, 0.07)" : "rgba(255, 250, 238, 0.12)";
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }
  if (light <= 0) return;
  // A warm edge-light along the top and left, and the far edges a shade darker.
  const top = context.createLinearGradient(0, 0, 0, height * 0.22);
  top.addColorStop(0, `rgba(255, 238, 200, ${0.16 * light})`);
  top.addColorStop(1, "rgba(255, 238, 200, 0)");
  context.fillStyle = top;
  context.fillRect(0, 0, width, height * 0.22);
  const left = context.createLinearGradient(0, 0, width * 0.16, 0);
  left.addColorStop(0, `rgba(255, 238, 200, ${0.1 * light})`);
  left.addColorStop(1, "rgba(255, 238, 200, 0)");
  context.fillStyle = left;
  context.fillRect(0, 0, width * 0.16, height);
  const far = context.createLinearGradient(0, height * 0.8, 0, height);
  far.addColorStop(0, "rgba(70, 50, 24, 0)");
  far.addColorStop(1, `rgba(70, 50, 24, ${0.08 * light})`);
  context.fillStyle = far;
  context.fillRect(0, height * 0.8, width, height * 0.2);
}

/**
 * Wood grain running the long way: fine, slightly wandering lines of varied
 * weight over `width` × `height` units, vertical or horizontal.
 */
export function paintGrain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  vertical: boolean,
  dark: string,
  light: string,
  density = 1,
) {
  const random = seeded(seed);
  const across = vertical ? width : height;
  const along = vertical ? height : width;
  const lines = Math.round(across * 0.9 * density);
  for (let line = 0; line < lines; line += 1) {
    const at = random() * across;
    const drift = (random() - 0.5) * 3;
    const wave = 0.4 + random() * 1.2;
    const phase = random() * Math.PI * 2;
    context.strokeStyle = random() < 0.7 ? dark : light;
    context.lineWidth = 0.15 + random() * 0.35;
    context.beginPath();
    for (let step = 0; step <= 12; step += 1) {
      const t = step / 12;
      const offset = at + drift * t + Math.sin(t * Math.PI * 2 * wave + phase) * 0.7;
      const x = vertical ? offset : t * along;
      const y = vertical ? t * along : offset;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
}
