import { describe, expect, it } from "vitest";

import { HIDDEN_PAGE_GAIN, pageVisibilityGain } from "./audioPolicy";

describe("pageVisibilityGain", () => {
  it("ducks audio while the reader is hidden", () => {
    expect(pageVisibilityGain("hidden")).toBe(HIDDEN_PAGE_GAIN);
  });

  it("restores full configured gain in every visible state", () => {
    expect(pageVisibilityGain("visible")).toBe(1);
    expect(pageVisibilityGain("prerender")).toBe(1);
  });
});
