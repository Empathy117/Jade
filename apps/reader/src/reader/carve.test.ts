import { describe, expect, it } from "vitest";

import {
  CARVE_COLS,
  CARVE_COVERAGE,
  CARVE_ROWS,
  CARVE_STROKES,
  Carving,
  figureOutline,
  inFigure,
} from "./carve";

function sweep(carving: Carving) {
  // Drag the knife across every row of the block, edge to edge.
  for (let row = 0; row <= CARVE_ROWS; row += 1) {
    carving.pare(-1, row, CARVE_COLS + 1, row);
    carving.lift();
  }
}

describe("Carving", () => {
  it("never cuts into the figure", () => {
    for (const stage of ["finish", "rough"] as const) {
      const carving = new Carving(stage);
      const figure = carving.cells.filter((cell) => cell === 1).length;
      sweep(carving);
      expect(carving.cells.filter((cell) => cell === 1).length).toBe(figure);
      expect(carving.removed).toBe(carving.waste);
      expect(carving.progress()).toBe(1);
    }
  });

  it("finishes once enough waste is gone", () => {
    const carving = new Carving("finish");
    let row = 0;
    while (carving.removed / carving.waste < CARVE_COVERAGE - 0.02) {
      carving.pare(-1, row, CARVE_COLS + 1, row + 0.5);
      row += 1;
    }
    expect(carving.progress()).toBeGreaterThan(0.9);
    expect(carving.progress()).toBeLessThan(1);
    carving.pare(-1, row, CARVE_COLS + 1, row + 0.5);
    carving.pare(-1, row + 1, CARVE_COLS + 1, row + 1.5);
    expect(carving.progress()).toBe(1);
  });

  it("finishes after enough strokes however little they pare", () => {
    const carving = new Carving("finish");
    // Strokes down the figure's middle pare nothing but still count.
    for (let stroke = 0; stroke < CARVE_STROKES - 1; stroke += 1) {
      carving.pare(CARVE_COLS / 2, 14, CARVE_COLS / 2, 30);
      carving.lift();
    }
    expect(carving.removed).toBe(0);
    expect(carving.progress()).toBeLessThan(1);
    carving.pare(CARVE_COLS / 2, 14, CARVE_COLS / 2, 30);
    carving.lift();
    expect(carving.progress()).toBe(1);
  });

  it("counts only drags that travel far enough", () => {
    const carving = new Carving("finish");
    carving.pare(1, 1, 2, 1);
    carving.lift();
    expect(carving.strokes).toBe(0);
    carving.pare(1, 1, 5, 1);
    carving.lift();
    expect(carving.strokes).toBe(1);
  });
});

describe("the figure", () => {
  it("is a slender standing figure: head, neck, shoulders, robe, plinth", () => {
    expect(inFigure(0.5, 0.11, "finish")).toBe(true); // head
    expect(inFigure(0.62, 0.11, "finish")).toBe(false); // beside the head
    expect(inFigure(0.5, 0.185, "finish")).toBe(true); // neck
    expect(inFigure(0.45, 0.185, "finish")).toBe(false);
    expect(inFigure(0.63, 0.3, "finish")).toBe(true); // shoulder
    expect(inFigure(0.63, 0.5, "finish")).toBe(false); // waist is narrower
    expect(inFigure(0.3, 0.97, "finish")).toBe(true); // plinth
    expect(inFigure(0.05, 0.5, "finish")).toBe(false);
  });

  it("is coarser and wider before it is finished", () => {
    for (let row = 0; row < CARVE_ROWS; row += 1) {
      for (let col = 0; col < CARVE_COLS; col += 1) {
        const u = (col + 0.5) / CARVE_COLS;
        const v = (row + 0.5) / CARVE_ROWS;
        if (inFigure(u, v, "finish") && v > 0.03) expect(inFigure(u, v, "rough")).toBe(true);
      }
    }
  });

  it("has a closed outline inside the block", () => {
    for (const stage of ["finish", "rough"] as const) {
      const outline = figureOutline(stage);
      expect(outline.length % 2).toBe(0);
      expect(outline.length).toBeGreaterThan(16);
      expect(Math.min(...outline)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...outline)).toBeLessThanOrEqual(1);
    }
  });
});
