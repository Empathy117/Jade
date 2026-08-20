import { describe, expect, it } from "vitest";

import { expandHistoryWindow, historyWindowAround } from "./historyWindow";

describe("history window", () => {
  it("centres on the reading position", () => {
    expect(historyWindowAround(1, 1000, 500, 10)).toEqual({ start: 490, end: 510 });
  });

  it("keeps its full size at either end by shifting, not shrinking", () => {
    expect(historyWindowAround(1, 1000, 2, 10)).toEqual({ start: 1, end: 21 });
    expect(historyWindowAround(1, 1000, 999, 10)).toEqual({ start: 980, end: 1000 });
  });

  it("collapses to the available range when less has been read than the radius", () => {
    expect(historyWindowAround(1, 4, 3, 10)).toEqual({ start: 1, end: 4 });
  });

  it("handles a book opened at its very first paragraph", () => {
    expect(historyWindowAround(1, 1, 1, 10)).toEqual({ start: 1, end: 1 });
    expect(historyWindowAround(5, 4, 5, 10)).toEqual({ start: 5, end: 5 });
  });

  it("grows one edge at a time and stops at the range boundary", () => {
    const window = { start: 100, end: 120 };

    expect(expandHistoryWindow(window, "earlier", 1, 1000, 50)).toEqual({
      start: 50,
      end: 120,
    });
    expect(expandHistoryWindow(window, "later", 1, 1000, 50)).toEqual({
      start: 100,
      end: 170,
    });
    expect(expandHistoryWindow(window, "earlier", 90, 1000, 50)).toEqual({
      start: 90,
      end: 120,
    });
    expect(expandHistoryWindow(window, "later", 1, 130, 50)).toEqual({
      start: 100,
      end: 130,
    });
  });
});
