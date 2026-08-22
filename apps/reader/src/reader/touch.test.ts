import { describe, expect, it } from "vitest";

import { resolveSwipe } from "./touch";

describe("swipe interpretation", () => {
  it("turns the page forward on a left swipe and back on a right swipe", () => {
    expect(resolveSwipe(-90, 4)).toBe("next");
    expect(resolveSwipe(90, -6)).toBe("previous");
  });

  it("ignores gestures shorter than the threshold", () => {
    expect(resolveSwipe(-30, 0)).toBeNull();
    expect(resolveSwipe(55, 0)).toBeNull();
  });

  it("leaves mostly vertical gestures to native scene scrolling", () => {
    expect(resolveSwipe(-80, 120)).toBeNull();
    expect(resolveSwipe(70, -70)).toBeNull();
  });
});
