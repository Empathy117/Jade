import { describe, expect, it } from "vitest";

import { appMetadata } from "./appMetadata";

describe("app metadata", () => {
  it("identifies the current multi-book phase", () => {
    expect(appMetadata.name).toBe("AI Director + Reader Runtime");
    expect(appMetadata.phase).toContain("Phase 5");
  });
});
