import { describe, expect, it } from "vitest";

import { searchExcerpt, searchReadParagraphs } from "./search";
import type { Paragraph } from "./types";

function paragraph(id: string, kind: Paragraph["kind"], text: string): Paragraph {
  return { id, kind, text };
}

const BOOK: Paragraph[] = [
  paragraph("p01", "title", "书名"),
  paragraph("p02", "chapter_heading", "第一章"),
  paragraph("p03", "prose", "冰块在午后闪闪发亮。"),
  paragraph("p04", "note", "① 冰块的注释不参与检索。"),
  paragraph("p05", "prose", "他们又一次谈起冰块，冰块从不融化。"),
  paragraph("p06", "prose", "结尾提到未来的冰块。"),
];

describe("searchReadParagraphs", () => {
  it("finds matches only inside the read range", () => {
    const result = searchReadParagraphs(BOOK, "冰块", 1, 4);
    expect(result.total).toBe(2);
    expect(result.matches.map((match) => match.paragraphId)).toEqual(["p03", "p05"]);
    // p06 sits beyond the furthest-read paragraph: never revealed.
    expect(result.matches.some((match) => match.paragraphId === "p06")).toBe(false);
  });

  it("skips apparatus paragraphs and blank queries", () => {
    const result = searchReadParagraphs(BOOK, "冰块", 1, 5);
    expect(result.matches.some((match) => match.paragraphId === "p04")).toBe(false);
    expect(searchReadParagraphs(BOOK, "   ", 1, 5).total).toBe(0);
  });

  it("counts occurrences inside one paragraph", () => {
    const result = searchReadParagraphs(BOOK, "冰块", 1, 4);
    expect(result.matches[1].occurrences).toBe(2);
  });

  it("matches case-insensitively", () => {
    const book = [paragraph("p01", "prose", "He whispered Macondo softly.")];
    const result = searchReadParagraphs(book, "macondo", 0, 0);
    expect(result.total).toBe(1);
  });

  it("caps the listing while reporting the true total", () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      paragraph(`p${index}`, "prose" as const, "重复出现的句子。"),
    );
    const result = searchReadParagraphs(many, "重复", 0, 7, 3);
    expect(result.matches).toHaveLength(3);
    expect(result.total).toBe(8);
  });

  it("builds a bounded excerpt around the first hit", () => {
    const text = `${"前".repeat(60)}目标词${"后".repeat(60)}`;
    const result = searchReadParagraphs([paragraph("p01", "prose", text)], "目标词", 0, 0);
    const excerpt = searchExcerpt(result.matches[0]);
    expect(excerpt.match).toBe("目标词");
    expect(excerpt.prefix.startsWith("…")).toBe(true);
    expect(excerpt.suffix.endsWith("…")).toBe(true);
    expect(excerpt.prefix.length).toBeLessThanOrEqual(30);
  });
});
