import { describe, expect, it } from "vitest";

import {
  chapterNotes,
  flowPositionCounts,
  isFlowParagraph,
  lastFlowIndex,
  nextFlowIndex,
  previousFlowIndex,
  segmentMarkers,
  snapToFlow,
} from "./notes";
import type { Paragraph } from "./types";

function paragraph(id: string, kind: Paragraph["kind"], text: string): Paragraph {
  return { id, kind, text };
}

const BOOK: Paragraph[] = [
  paragraph("p01", "title", "书名"),
  paragraph("p02", "nav", "第一回 链接目录"),
  paragraph("p03", "chapter_heading", "第一回 甄士隐梦幻识通灵〔一〕"),
  paragraph("p04", "prose", "正文之一[1]，又见校记〔一〕。"),
  paragraph("p05", "prose", "正文之二[2]。"),
  paragraph("p06", "note", "[1] 首注——解释之一。"),
  paragraph("p07", "note", "[2] 次注——解释之二。"),
  paragraph("p08", "note", "〔一〕 校记——版本异文。"),
  paragraph("p09", "chapter_heading", "第二回"),
  paragraph("p10", "prose", "第二回正文[1]。"),
  paragraph("p11", "note", "[1] 第二回的注。"),
];

describe("reading flow", () => {
  it("skips apparatus paragraphs in both directions", () => {
    expect(isFlowParagraph(BOOK[1])).toBe(false);
    expect(nextFlowIndex(BOOK, 4)).toBe(8);
    expect(nextFlowIndex(BOOK, 8)).toBe(9);
    expect(previousFlowIndex(BOOK, 8, 0)).toBe(4);
    expect(previousFlowIndex(BOOK, 9, 0)).toBe(8);
  });

  it("ends the book on the last flow paragraph", () => {
    expect(lastFlowIndex(BOOK)).toBe(9);
  });

  it("snaps stranded positions onto the flow", () => {
    expect(snapToFlow(BOOK, 4)).toBe(4);
    expect(snapToFlow(BOOK, 6)).toBe(8);
    expect(snapToFlow(BOOK, 10)).toBe(9);
    expect(snapToFlow(BOOK, 1)).toBe(2);
  });

  it("counts progress over flow paragraphs only", () => {
    const counts = flowPositionCounts(BOOK);
    expect(counts[0]).toBe(1);
    expect(counts[1]).toBe(1);
    expect(counts[7]).toBe(4);
    expect(counts[10]).toBe(6);
  });
});

describe("note markers", () => {
  it("segments arabic and CJK markers", () => {
    const segments = segmentMarkers("正文[12]与校记〔一〇〕并存。");
    expect(segments).toEqual([
      { kind: "text", value: "正文" },
      { kind: "marker", value: "[12]" },
      { kind: "text", value: "与校记" },
      { kind: "marker", value: "〔一〇〕" },
      { kind: "text", value: "并存。" },
    ]);
  });

  it("maps a chapter's markers to its own note paragraphs", () => {
    const notes = chapterNotes(BOOK, 4);
    expect(notes.get("[1]")).toBe(5);
    expect(notes.get("[2]")).toBe(6);
    expect(notes.get("〔一〕")).toBe(7);
    expect(chapterNotes(BOOK, 9).get("[1]")).toBe(10);
  });
});
