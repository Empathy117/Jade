import { describe, expect, it } from "vitest";

import { currentChapterIndex, unlockedChapters } from "./chapters";
import type { Paragraph } from "./types";

const paragraphs: Paragraph[] = [
  { id: "p0001", kind: "title", text: "书名" },
  { id: "p0002", kind: "prose", text: "前言" },
  { id: "p0003", kind: "chapter_heading", text: "第一章 出发" },
  { id: "p0004", kind: "prose", text: "……" },
  { id: "p0005", kind: "chapter_heading", text: "第二章 抵达" },
  { id: "p0006", kind: "prose", text: "……" },
  { id: "p0007", kind: "chapter_heading", text: "第三章 归来" },
  { id: "p0008", kind: "prose", text: "……" },
];

describe("chapters", () => {
  it("lists only headings the reader has reached", () => {
    expect(unlockedChapters(paragraphs, 1, 5)).toEqual([
      { index: 2, text: "第一章 出发" },
      { index: 4, text: "第二章 抵达" },
    ]);
  });

  it("hides front matter skipped by a preferred start", () => {
    expect(unlockedChapters(paragraphs, 4, 7)).toEqual([
      { index: 4, text: "第二章 抵达" },
      { index: 6, text: "第三章 归来" },
    ]);
  });

  it("is empty for a book with no chapter headings", () => {
    const flat = paragraphs.map((paragraph) => ({
      ...paragraph,
      kind: paragraph.kind === "chapter_heading" ? ("prose" as const) : paragraph.kind,
    }));
    expect(unlockedChapters(flat, 1, 7)).toEqual([]);
  });

  it("resolves which chapter the reading position falls in", () => {
    const chapters = unlockedChapters(paragraphs, 1, 7);
    expect(currentChapterIndex(chapters, 1)).toBeNull();
    expect(currentChapterIndex(chapters, 3)).toBe(2);
    expect(currentChapterIndex(chapters, 4)).toBe(4);
    expect(currentChapterIndex(chapters, 7)).toBe(6);
  });
});
