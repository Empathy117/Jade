import { describe, expect, it } from "vitest";

import { EDGE_BAND, edgePull, edgeSpeed } from "./useSelectionAutoscroll";

describe("selection sweep edges", () => {
  const top = 100;
  const bottom = 700;

  it("leaves the middle of the text alone", () => {
    expect(edgePull(400, top, bottom)).toEqual({ edge: null, strength: 0 });
    expect(edgePull(top + EDGE_BAND + 1, top, bottom).edge).toBeNull();
  });

  it("pulls harder the closer the pointer is to an edge, and fully beyond it", () => {
    const inner = edgePull(top + EDGE_BAND - 8, top, bottom);
    const rim = edgePull(top + 2, top, bottom);
    expect(inner.edge).toBe("up");
    expect(rim.edge).toBe("up");
    expect(rim.strength).toBeGreaterThan(inner.strength);
    expect(edgePull(top - 80, top, bottom)).toEqual({ edge: "up", strength: 1 });
    expect(edgePull(bottom + 30, top, bottom)).toEqual({ edge: "down", strength: 1 });
  });

  it("shrinks the bands on a short viewport so the middle stays still", () => {
    expect(edgePull(150, 100, 300).edge).toBeNull();
    expect(edgePull(140, 100, 300).edge).toBe("up");
  });

  it("scrolls slowly at the band's inner edge and briskly at the rim", () => {
    expect(edgeSpeed(0)).toBeLessThan(edgeSpeed(0.5));
    expect(edgeSpeed(0.5)).toBeLessThan(edgeSpeed(1));
    expect(edgeSpeed(0)).toBeGreaterThan(0);
  });
});
