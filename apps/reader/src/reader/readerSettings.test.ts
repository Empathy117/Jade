import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, parseSettings } from "./readerSettings";

describe("reader settings", () => {
  it("keeps defaults when nothing was saved", () => {
    expect(parseSettings(null, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("merges a partial save over the defaults", () => {
    expect(parseSettings('{"fontScale":1.2}', DEFAULT_SETTINGS)).toEqual({
      ...DEFAULT_SETTINGS,
      fontScale: 1.2,
    });
  });

  it("falls back to defaults rather than throwing on unusable saves", () => {
    expect(parseSettings("not json", DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("null", DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"a string"', DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
});
