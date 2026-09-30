/** How the text leaves the figure at this beat (ADR-0012). */
export type CarveStage = "rough" | "finish";

/** The block's grid: columns across, rows down. Cells are close to square. */
export const CARVE_COLS = 24;
export const CARVE_ROWS = 40;
/** Share of the waste wood that, once pared, completes the carving. */
export const CARVE_COVERAGE = 0.6;
/** Counted strokes that complete the carving however little they pared. */
export const CARVE_STROKES = 12;
/** Cells a drag must travel to count as a stroke. */
export const STROKE_MIN = 3;
/** The knife's reach either side of its path, in cells. */
export const KNIFE_REACH = 1.7;

/** The block's height over its width, for drawing the head round. */
const ASPECT = 117 / 68;

/**
 * Half the figure's width at a height down the block, both as shares of the
 * block: `v` runs 0 at the top to 1 at the foot. The head is separate.
 * A narrow neck, slight shoulders, a long robe widening to the foot, a plinth.
 */
function bodyHalfWidth(v: number): number {
  if (v < 0.17 || v > 1) return 0;
  if (v < 0.2) return 0.035;
  if (v < 0.27) {
    // Sloping shoulders, rounded rather than square.
    const t = (v - 0.2) / 0.07;
    return 0.035 + Math.sin((t * Math.PI) / 2) * 0.115;
  }
  if (v < 0.47) return 0.15 - ((v - 0.27) / 0.2) * 0.04;
  if (v < 0.93) return 0.11 + ((v - 0.47) / 0.46) * 0.085;
  return 0.22;
}

const HEAD = { v: 0.11, rx: 0.085, ry: 0.1 / ASPECT };

/** The coarser, faceted outline a figure has before it is finished. */
const ROUGH_BANDS = 8;
function roughHalfWidth(v: number): number {
  if (v < 0.03 || v > 1) return 0;
  if (v < 0.2) return 0.12;
  const band = Math.min(ROUGH_BANDS - 1, Math.floor(((v - 0.2) / 0.8) * ROUGH_BANDS));
  const top = 0.2 + (band / ROUGH_BANDS) * 0.8;
  const bottom = 0.2 + ((band + 1) / ROUGH_BANDS) * 0.8;
  const widest = Math.max(bodyHalfWidth(top), bodyHalfWidth(bottom - 1e-6), bodyHalfWidth((top + bottom) / 2));
  return Math.min(0.46, widest + 0.05);
}

/** Whether a point on the block, as shares of its width and height, belongs to the figure. */
export function inFigure(u: number, v: number, stage: CarveStage): boolean {
  const across = Math.abs(u - 0.5);
  if (stage === "rough") return across <= roughHalfWidth(v);
  const head = ((u - 0.5) / HEAD.rx) ** 2 + ((v - HEAD.v) / HEAD.ry) ** 2 <= 1;
  return head || across <= bodyHalfWidth(v);
}

/**
 * The figure's outline for drawing, as x, y pairs in shares of the block,
 * clockwise from the top of the head. The finished figure is smooth; the
 * rough one is cut in straight facets.
 */
export function figureOutline(stage: CarveStage): Float32Array {
  const points: number[] = [];
  const push = (u: number, v: number) => points.push(u, v);
  if (stage === "rough") {
    // A faceted head block, then the body band by band down one side and up the other.
    const edges: number[] = [0.2];
    for (let band = 1; band <= ROUGH_BANDS; band += 1) edges.push(0.2 + (band / ROUGH_BANDS) * 0.8);
    push(0.45, 0.03);
    push(0.55, 0.03);
    push(0.62, 0.09);
    push(0.62, 0.19);
    for (const v of edges.slice(1)) push(0.5 + roughHalfWidth(v - 0.05), v - 0.05);
    push(0.5 + roughHalfWidth(0.99), 1);
    push(0.5 - roughHalfWidth(0.99), 1);
    for (const v of edges.slice(1).reverse()) push(0.5 - roughHalfWidth(v - 0.05), v - 0.05);
    push(0.38, 0.19);
    push(0.38, 0.09);
    return new Float32Array(points);
  }
  // Over the head from the left of the neck to the right of it.
  const neck = Math.acos(0.035 / HEAD.rx);
  const steps = 18;
  for (let step = 0; step <= steps; step += 1) {
    const angle = Math.PI - neck + ((Math.PI + 2 * neck) * step) / steps;
    push(0.5 + HEAD.rx * Math.cos(angle), HEAD.v + HEAD.ry * Math.sin(angle));
  }
  const samples = 36;
  for (let sample = 0; sample <= samples; sample += 1) {
    const v = 0.17 + ((0.93 - 0.17) * sample) / samples;
    push(0.5 + bodyHalfWidth(Math.min(v, 0.9299)), v);
  }
  push(0.5 + 0.22, 0.93);
  push(0.5 + 0.22, 1);
  push(0.5 - 0.22, 1);
  push(0.5 - 0.22, 0.93);
  for (let sample = samples; sample >= 0; sample -= 1) {
    const v = 0.17 + ((0.93 - 0.17) * sample) / samples;
    push(0.5 - bodyHalfWidth(Math.min(v, 0.9299)), v);
  }
  return new Float32Array(points);
}

/**
 * The state of one carving: which waste cells the knife has pared away, and
 * how many strokes it has made. Figure cells are never pared.
 */
export class Carving {
  readonly stage: CarveStage;
  /** 1 for a figure cell, 0 for waste still on the block, 2 for waste pared away. */
  readonly cells: Uint8Array;
  readonly waste: number;
  removed = 0;
  strokes = 0;
  private travelled = 0;

  constructor(stage: CarveStage) {
    this.stage = stage;
    this.cells = new Uint8Array(CARVE_COLS * CARVE_ROWS);
    let waste = 0;
    for (let row = 0; row < CARVE_ROWS; row += 1) {
      for (let col = 0; col < CARVE_COLS; col += 1) {
        const figure = inFigure((col + 0.5) / CARVE_COLS, (row + 0.5) / CARVE_ROWS, stage);
        this.cells[row * CARVE_COLS + col] = figure ? 1 : 0;
        if (!figure) waste += 1;
      }
    }
    this.waste = waste;
  }

  /**
   * Draw the knife from one point to another, in cells. Pares the waste
   * within reach of the path and returns how many cells came away.
   */
  pare(x0: number, y0: number, x1: number, y1: number): number {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    this.travelled += length;
    const reach = KNIFE_REACH;
    const colFrom = Math.max(0, Math.floor(Math.min(x0, x1) - reach));
    const colTo = Math.min(CARVE_COLS - 1, Math.ceil(Math.max(x0, x1) + reach));
    const rowFrom = Math.max(0, Math.floor(Math.min(y0, y1) - reach));
    const rowTo = Math.min(CARVE_ROWS - 1, Math.ceil(Math.max(y0, y1) + reach));
    let pared = 0;
    for (let row = rowFrom; row <= rowTo; row += 1) {
      for (let col = colFrom; col <= colTo; col += 1) {
        const index = row * CARVE_COLS + col;
        if (this.cells[index] !== 0) continue;
        const cx = col + 0.5;
        const cy = row + 0.5;
        const t = length > 0 ? Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / (length * length))) : 0;
        if (Math.hypot(cx - (x0 + dx * t), cy - (y0 + dy * t)) <= reach) {
          this.cells[index] = 2;
          pared += 1;
        }
      }
    }
    this.removed += pared;
    return pared;
  }

  /** Lift the knife: a drag that travelled far enough counts as a stroke. */
  lift(): void {
    if (this.travelled >= STROKE_MIN) this.strokes += 1;
    this.travelled = 0;
  }

  /** How close the carving is to done, 0 to 1. */
  progress(): number {
    const pared = this.waste > 0 ? this.removed / this.waste / CARVE_COVERAGE : 1;
    return Math.min(1, Math.max(pared, this.strokes / CARVE_STROKES));
  }
}
