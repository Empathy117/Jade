import { describe, expect, it } from "vitest";

import { readingBeats, splitAtNaturalBreaks } from "./readingBeats";
import type { Paragraph } from "./types";

describe("splitAtNaturalBreaks", () => {
  it("keeps short text on one page", () => {
    const text = "世界新生伊始。";
    expect(splitAtNaturalBreaks(text)).toEqual([text]);
  });

  it("prefers sentence boundaries and preserves every source character", () => {
    const text = `${"甲".repeat(110)}。${"乙".repeat(110)}！${"丙".repeat(100)}`;
    const beats = splitAtNaturalBreaks(text);

    expect(beats).toHaveLength(3);
    expect(beats.join("")).toBe(text);
    expect(beats[0].endsWith("。")).toBe(true);
    expect(beats[1].endsWith("！")).toBe(true);
    expect(Math.max(...beats.map((beat) => Array.from(beat).length))).toBeLessThanOrEqual(180);
  });

  it("falls back to comma boundaries for a very long sentence", () => {
    const text = `${"甲".repeat(100)}，${"乙".repeat(100)}，${"丙".repeat(100)}。`;
    const beats = splitAtNaturalBreaks(text);

    expect(beats.join("")).toBe(text);
    expect(beats.length).toBeGreaterThan(1);
  });
});

describe("readingBeats", () => {
  it("keeps headings intact and numbers prose pages", () => {
    const heading: Paragraph = { id: "p0001", kind: "chapter_heading", text: "第一章" };
    const prose: Paragraph = { id: "p0002", kind: "prose", text: "句子。".repeat(80) };

    expect(readingBeats(heading)).toEqual([{ text: "第一章", index: 0, total: 1 }]);
    const beats = readingBeats(prose);
    expect(beats[0].index).toBe(0);
    expect(beats.at(-1)?.index).toBe(beats.length - 1);
    expect(beats.every((beat) => beat.total === beats.length)).toBe(true);
    expect(beats.map((beat) => beat.text).join("")).toBe(prose.text);
  });
});
