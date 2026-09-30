import { describe, expect, it } from "vitest";

import { BRUSH_REACH, COSMETICS_COVERAGE, Complexion, FIELD, fieldOutline, inField } from "./cosmetics";

describe("Complexion", () => {
  it("warms only the field, and every part of it once", () => {
    const complexion = new Complexion();
    const offField = complexion.cells.filter((cell) => cell === 0).length;
    for (let y = 0; y <= 140; y += BRUSH_REACH) complexion.brush(-20, y, 220, y);
    expect(complexion.cells.filter((cell) => cell === 0).length).toBe(offField);
    expect(complexion.warmed).toBe(complexion.total);
    expect(complexion.progress()).toBe(1);
    // Brushing warm cells again warms nothing more.
    expect(complexion.brush(0, 70, 200, 70)).toBe(0);
  });

  it("finishes once enough of the field is warm", () => {
    const complexion = new Complexion();
    let y = FIELD.cy - FIELD.ry;
    while (complexion.warmed / complexion.total < COSMETICS_COVERAGE - 0.05) {
      complexion.brush(0, y, 200, y);
      y += 4;
    }
    expect(complexion.progress()).toBeLessThan(1);
    while (complexion.progress() < 1) {
      complexion.brush(0, y, 200, y);
      y += 4;
    }
    expect(complexion.warmed / complexion.total).toBeGreaterThanOrEqual(COSMETICS_COVERAGE);
    expect(complexion.warmed / complexion.total).toBeLessThan(0.85);
  });

  it("lays nothing from strokes off the field", () => {
    const complexion = new Complexion();
    complexion.brush(0, 2, 30, 4);
    complexion.brush(170, 136, 200, 138);
    expect(complexion.warmed).toBe(0);
  });
});

describe("the field", () => {
  it("is a soft oval wider than it is tall, traced by its outline", () => {
    const outline = fieldOutline(48);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < outline.length; index += 2) {
      const x = outline[index];
      const y = outline[index + 1];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      // Just inside the outline is field; just outside is not.
      expect(inField(FIELD.cx + (x - FIELD.cx) * 0.97, FIELD.cy + (y - FIELD.cy) * 0.97)).toBe(true);
      expect(inField(FIELD.cx + (x - FIELD.cx) * 1.03, FIELD.cy + (y - FIELD.cy) * 1.03)).toBe(false);
    }
    expect(maxX - minX).toBeGreaterThan((maxY - minY) * 1.3);
    expect(minX).toBeGreaterThan(0);
    expect(maxY).toBeLessThan(140);
  });
});
