/**
 * The glazed field of the making-up gesture (ADR-0013), in the gesture
 * plate's 200 × 140 drawing units: a soft, slightly irregular oval, wider
 * than it is tall, so it reads as a tile of porcelain and never as a head.
 */
export const FIELD = { cx: 100, cy: 70, rx: 72, ry: 46 };
/** Share of the field that, once warmed, completes the gesture. */
export const COSMETICS_COVERAGE = 0.6;
/** How far either side of its path the brush lays colour, in drawing units. */
export const BRUSH_REACH = 11;
/** Coverage is measured on a grid of square cells this many units across. */
export const COSMETICS_CELL = 4;
const COLS = Math.ceil(200 / COSMETICS_CELL);
const ROWS = Math.ceil(140 / COSMETICS_CELL);

/** The field's radius at an angle, as a share of the plain ellipse's. */
export function fieldScale(angle: number): number {
  return 1 + 0.045 * Math.sin(3 * angle + 0.7) + 0.025 * Math.sin(5 * angle + 2.1) + 0.015 * Math.sin(2 * angle + 4);
}

/** Whether a point in drawing units lies on the field. */
export function inField(x: number, y: number): boolean {
  const dx = (x - FIELD.cx) / FIELD.rx;
  const dy = (y - FIELD.cy) / FIELD.ry;
  const radius = Math.hypot(dx, dy);
  return radius === 0 || radius <= fieldScale(Math.atan2(dy, dx));
}

/** The field's outline as x, y pairs in drawing units, for tracing and clipping. */
export function fieldOutline(points = 72): Float32Array {
  const outline = new Float32Array(points * 2);
  for (let point = 0; point < points; point += 1) {
    const angle = (point / points) * Math.PI * 2;
    const scale = fieldScale(angle);
    outline[point * 2] = FIELD.cx + Math.cos(angle) * FIELD.rx * scale;
    outline[point * 2 + 1] = FIELD.cy + Math.sin(angle) * FIELD.ry * scale;
  }
  return outline;
}

/**
 * How much of the field the brush has warmed: 0 for a cell off the field,
 * 1 for a bare cell, 2 for one the brush has passed over.
 */
export class Complexion {
  readonly cells: Uint8Array;
  readonly total: number;
  warmed = 0;

  constructor() {
    this.cells = new Uint8Array(COLS * ROWS);
    let total = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const onField = inField((col + 0.5) * COSMETICS_CELL, (row + 0.5) * COSMETICS_CELL);
        this.cells[row * COLS + col] = onField ? 1 : 0;
        if (onField) total += 1;
      }
    }
    this.total = total;
  }

  /**
   * Draw the brush from one point to another, in drawing units. Warms the
   * bare cells within reach of the path and returns how many it warmed.
   */
  brush(x0: number, y0: number, x1: number, y1: number): number {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const lengthSquared = dx * dx + dy * dy;
    const reach = BRUSH_REACH;
    const colFrom = Math.max(0, Math.floor((Math.min(x0, x1) - reach) / COSMETICS_CELL));
    const colTo = Math.min(COLS - 1, Math.floor((Math.max(x0, x1) + reach) / COSMETICS_CELL));
    const rowFrom = Math.max(0, Math.floor((Math.min(y0, y1) - reach) / COSMETICS_CELL));
    const rowTo = Math.min(ROWS - 1, Math.floor((Math.max(y0, y1) + reach) / COSMETICS_CELL));
    let warmed = 0;
    for (let row = rowFrom; row <= rowTo; row += 1) {
      for (let col = colFrom; col <= colTo; col += 1) {
        const index = row * COLS + col;
        if (this.cells[index] !== 1) continue;
        const cx = (col + 0.5) * COSMETICS_CELL;
        const cy = (row + 0.5) * COSMETICS_CELL;
        const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / lengthSquared)) : 0;
        if (Math.hypot(cx - (x0 + dx * t), cy - (y0 + dy * t)) <= reach) {
          this.cells[index] = 2;
          warmed += 1;
        }
      }
    }
    this.warmed += warmed;
    return warmed;
  }

  /** How close the field is to done, 0 to 1. */
  progress(): number {
    return this.total > 0 ? Math.min(1, this.warmed / this.total / COSMETICS_COVERAGE) : 1;
  }
}
