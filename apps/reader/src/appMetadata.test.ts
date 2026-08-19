import { describe, expect, it } from "vitest";

import { appMetadata } from "./appMetadata";

describe("app metadata", () => {
  it("identifies the Phase 1 scaffold", () => {
    expect(appMetadata.name).toBe("AI Director + Reader Runtime");
    expect(appMetadata.phase).toContain("Phase 1");
  });
});
