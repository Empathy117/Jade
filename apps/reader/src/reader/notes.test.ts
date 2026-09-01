import { describe, expect, it } from "vitest";

import {
  countMarkers,
  flowPositionCounts,
  isFlowParagraph,
  lastFlowIndex,
  nextFlowIndex,
  normalizeMarkerBreaks,
  previousFlowIndex,
  resolveNoteAnchors,
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
  paragraph("p03", "chapter_heading", "第一回 甄士隐梦幻识通灵"),
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
  it("segments arabic, CJK, and circled markers", () => {
    const segments = segmentMarkers("正文[12]与校记〔一〇〕并存①。");
    expect(segments).toEqual([
      { kind: "text", value: "正文" },
      { kind: "marker", value: "[12]" },
      { kind: "text", value: "与校记" },
      { kind: "marker", value: "〔一〇〕" },
      { kind: "text", value: "并存" },
      { kind: "marker", value: "①" },
      { kind: "text", value: "。" },
    ]);
    expect(countMarkers("正文[12]与校记〔一〇〕并存①。")).toBe(3);
  });

  it("folds the line breaks print typography puts around circled markers", () => {
    expect(normalizeMarkerBreaks("到处都是拟黄鹂\n①\n、金丝雀")).toBe(
      "到处都是拟黄鹂①、金丝雀",
    );
    expect(normalizeMarkerBreaks("句尾的标记\n①")).toBe("句尾的标记①");
    expect(normalizeMarkerBreaks("诗行之末[1]\n下一行")).toBe("诗行之末[1]\n下一行");
  });
});

describe("resolveNoteAnchors", () => {
  it("pairs chapter-end notes with unique markers by value", () => {
    const anchors = resolveNoteAnchors(BOOK);
    expect(anchors.markers.get("p04")).toEqual([[5], [7]]);
    expect(anchors.markers.get("p05")).toEqual([[6]]);
    expect(anchors.markers.get("p10")).toEqual([[10]]);
    expect(anchors.trailing.size).toBe(0);
  });

  it("pairs page-reset circled markers with their interleaved notes", () => {
    // The popular-translation layout: notes directly after their paragraph,
    // numbering restarting on every print page, so a chapter repeats ①.
    const book: Paragraph[] = [
      paragraph("h1", "chapter_heading", "第1章"),
      paragraph("a", "prose", "先看多卜隆\n①\n与赫尔曼修士\n②\n。"),
      paragraph("dialogue", "prose", "“地球是圆的。”"),
      paragraph("na1", "note", "① 多卜隆，西班牙古金币名。"),
      paragraph("na2", "note", "② 赫尔曼修士，德国本笃会修士。"),
      paragraph("b", "prose", "后文又见诺查丹玛斯\n①\n。"),
      paragraph("nb1", "note", "① 诺查丹玛斯，法国预言家。"),
    ];
    const anchors = resolveNoteAnchors(book);
    expect(anchors.markers.get("a")).toEqual([[3], [4]]);
    expect(anchors.markers.get("b")).toEqual([[6]]);
  });

  it("absorbs a misprinted number when a run matches its markers in count", () => {
    // 原书 birds run prints ①②②③ for four in-text markers ①②③④.
    const book: Paragraph[] = [
      paragraph("h1", "chapter_heading", "第1章"),
      paragraph("birds", "prose", "拟黄鹂\n①\n、金丝雀\n②\n、蓝鸲\n③\n、知更鸟\n④\n。"),
      paragraph("n1", "note", "① 拟黄鹂是一种黄鹂。"),
      paragraph("n2", "note", "② 金丝雀，又名芙蓉鸟。"),
      paragraph("n3", "note", "② 蓝鸲，北美鸫科鸟类。"),
      paragraph("n4", "note", "③ 知更鸟，也叫知更雀。"),
    ];
    const anchors = resolveNoteAnchors(book);
    expect(anchors.markers.get("birds")).toEqual([[2], [3], [4], [5]]);
  });

  it("opens unmarked continuation notes from the marker they follow", () => {
    // 译本对照: one in-text ① followed by two notes without leading markers.
    const book: Paragraph[] = [
      paragraph("h13", "chapter_heading", "第13章"),
      paragraph("a", "prose", "上帝还没让岁月缩水\n①\n，那时候不像现在。"),
      paragraph("v1", "note", "高长荣版：跟土耳其人量布的花招不一样。"),
      paragraph("v2", "note", "黄锦炎版：她心想，过去上帝安排年月时并不耍花招。"),
    ];
    const anchors = resolveNoteAnchors(book);
    expect(anchors.markers.get("a")).toEqual([[2, 3]]);
  });

  it("falls back to a paragraph chip when the in-text marker was lost", () => {
    const book: Paragraph[] = [
      paragraph("h1", "chapter_heading", "第1章"),
      paragraph("a", "prose", "有标记的一段\n①\n。"),
      paragraph("na", "note", "① 这段的注。"),
      paragraph("b", "prose", "标记在提取时丢失的一段。"),
      paragraph("nb", "note", "① 罗勒，唇形科罗勒属植物。"),
    ];
    const anchors = resolveNoteAnchors(book);
    expect(anchors.markers.get("a")).toEqual([[2]]);
    expect(anchors.markers.has("b")).toBe(false);
    expect(anchors.trailing.get("b")).toEqual([4]);
  });

  it("does not cascade when one bracket note lost its marker mid-chapter", () => {
    // 红楼梦第五回: [15] never appears in the text, [16] does. Value claims
    // must keep [16] on its own marker instead of shifting every later note.
    const book: Paragraph[] = [
      paragraph("h5", "chapter_heading", "第五回"),
      paragraph("a", "prose", "前文[14]与后文[16]。"),
      paragraph("n14", "note", "[14] 第十四注。"),
      paragraph("n15", "note", "[15] 正文里找不到锚点的注。"),
      paragraph("n16", "note", "[16] 第十六注。"),
    ];
    const anchors = resolveNoteAnchors(book);
    expect(anchors.markers.get("a")).toEqual([[2], [4]]);
    expect(anchors.trailing.get("a")).toEqual([3]);
  });

  it("never lets front-matter noise claim a chapter's notes", () => {
    // A copyright page carries CIP data full of circled numerals.
    const book: Paragraph[] = [
      paragraph("cip", "prose", "I.①百… Ⅱ.①马…②范… Ⅲ.①长篇小说"),
      paragraph("h1", "chapter_heading", "第1章"),
      paragraph("a", "prose", "正文的标记\n①\n。"),
      paragraph("na", "note", "① 正文的注。"),
    ];
    const anchors = resolveNoteAnchors(book);
    expect(anchors.markers.get("a")).toEqual([[3]]);
    const cip = anchors.markers.get("cip");
    expect(cip?.every((notes) => notes.length === 0)).toBe(true);
  });

  it("keeps navigation paragraphs out of note pairing", () => {
    const book: Paragraph[] = [
      paragraph("h1", "chapter_heading", "第1章"),
      paragraph("a", "prose", "最后一段\n①\n。"),
      paragraph("na", "note", "① 最后的注。"),
      paragraph("toc", "nav", "Table of Contents"),
      paragraph("t1", "nav", "第1章"),
    ];
    const anchors = resolveNoteAnchors(book);
    expect(anchors.markers.get("a")).toEqual([[2]]);
    expect(anchors.trailing.size).toBe(0);
  });
});
