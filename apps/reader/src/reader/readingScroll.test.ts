import { describe, expect, it } from "vitest";

import {
  calculateReadingScrollDelta,
  readingBottomSafeInset,
  readingScrollBehavior,
} from "./readingScroll";

describe("readingBottomSafeInset", () => {
  it("reserves about the bottom fifth of an ordinary reading viewport", () => {
    expect(readingBottomSafeInset(800)).toBe(176);
  });

  it("keeps the safe area usable at small and very large viewport sizes", () => {
    expect(readingBottomSafeInset(300)).toBe(96);
    expect(readingBottomSafeInset(2000)).toBe(280);
  });
});

describe("calculateReadingScrollDelta", () => {
  it("moves a paragraph above the bottom fade zone", () => {
    expect(calculateReadingScrollDelta(100, 800, 850)).toBe(126);
  });

  it("does not pull content downward after the reader has scrolled up", () => {
    expect(calculateReadingScrollDelta(100, 800, 650)).toBe(0);
  });
});

describe("readingScrollBehavior", () => {
  it("keeps the ordinary page turn smooth", () => {
    expect(readingScrollBehavior(140, 800, false)).toBe("smooth");
  });

  it("lands instantly when a resume or jump crosses more than a screen", () => {
    // Chrome silently drops smooth scrolls over long distances.
    expect(readingScrollBehavior(7000, 800, false)).toBe("auto");
  });

  it("honours reduced motion for any distance", () => {
    expect(readingScrollBehavior(140, 800, true)).toBe("auto");
  });
});
