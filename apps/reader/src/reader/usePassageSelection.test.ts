import { describe, expect, it } from "vitest";

import { placeSelectionToolbar } from "./usePassageSelection";

describe("placeSelectionToolbar", () => {
  const frame = { top: 100, bottom: 700, left: 0, right: 1000 };

  it("centres the toolbar above the selection", () => {
    expect(
      placeSelectionToolbar({ top: 400, bottom: 440, left: 300, right: 500 }, frame, 1000, false),
    ).toEqual({ x: 400, y: 390, below: false });
  });

  it("drops below a selection near the top edge", () => {
    expect(
      placeSelectionToolbar({ top: 110, bottom: 150, left: 300, right: 500 }, frame, 1000, false),
    ).toEqual({ x: 400, y: 160, below: true });
  });

  it("prefers below on touch, where the platform's callout sits above", () => {
    expect(
      placeSelectionToolbar({ top: 400, bottom: 440, left: 300, right: 500 }, frame, 1000, true)
        ?.below,
    ).toBe(true);
  });

  it("stays inside the window at either side", () => {
    const left = placeSelectionToolbar({ top: 400, bottom: 440, left: 0, right: 20 }, frame, 1000, false);
    const right = placeSelectionToolbar({ top: 400, bottom: 440, left: 980, right: 1000 }, frame, 1000, false);
    expect(left!.x).toBeGreaterThan(50);
    expect(right!.x).toBeLessThan(950);
  });

  it("measures only the visible part of a selection and docks one out of sight", () => {
    expect(
      placeSelectionToolbar({ top: 20, bottom: 300, left: 300, right: 500 }, frame, 1000, false),
    ).toEqual({ x: 400, y: 310, below: true });
    expect(
      placeSelectionToolbar({ top: 20, bottom: 90, left: 300, right: 500 }, frame, 1000, false),
    ).toBeNull();
  });
});
