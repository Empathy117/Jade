import { describe, expect, it } from "vitest";

import {
  annotationAnchorId,
  annotationExcerpt,
  annotationFor,
  clipText,
  listAnnotations,
  parseAnnotations,
  passageAnnotationId,
  passageMarks,
  passageQuote,
  upsertAnnotation,
} from "./annotations";
import type { PassageRange } from "./annotations";
import type { Paragraph } from "./types";

describe("annotations", () => {
  it("parses saved annotations and drops malformed entries", () => {
    expect(parseAnnotations(null)).toEqual([]);
    expect(parseAnnotations("{}")).toEqual([]);
    expect(
      parseAnnotations('[{"id":"p0004","text":"眉批","updatedAt":3},{"id":"p0005"}]'),
    ).toEqual([{ id: "p0004", text: "眉批", updatedAt: 3 }]);
  });

  it("creates, revises, and keeps list order stable", () => {
    let list = upsertAnnotation([], "p0002", "初读感受", 1);
    list = upsertAnnotation(list, "p0004", "第二段的想法", 2);
    list = upsertAnnotation(list, "p0002", "改后的感受", 3);

    expect(list.map((annotation) => annotation.id)).toEqual(["p0002", "p0004"]);
    expect(annotationFor(list, "p0002")).toEqual({
      id: "p0002",
      text: "改后的感受",
      updatedAt: 3,
    });
  });

  it("removes the annotation when the text empties", () => {
    const list = upsertAnnotation([], "p0002", "会被删掉", 1);
    expect(upsertAnnotation(list, "p0002", "   ", 2)).toEqual([]);
  });

  it("trims surrounding whitespace before saving", () => {
    const list = upsertAnnotation([], "p0002", "  想法  ", 1);
    expect(annotationFor(list, "p0002")?.text).toBe("想法");
  });
});

describe("passage annotations", () => {
  const paragraphs: Paragraph[] = [
    { id: "p0001", kind: "title", text: "测试之书" },
    { id: "p0002", kind: "prose", text: "山路越走越深。\n风停了。" },
    { id: "p0003", kind: "note", text: "① 编者注。" },
    { id: "p0004", kind: "prose", text: "两位绅士①站在门前。" },
    { id: "p0005", kind: "prose", text: "门上写着字。" },
  ];
  const positions = new Map(paragraphs.map((paragraph, index) => [paragraph.id, index]));
  const across: PassageRange = {
    start: { paragraphId: "p0002", offset: 8 },
    end: { paragraphId: "p0004", offset: 4 },
  };

  it("keys a passage by both of its anchors, apart from paragraph ids", () => {
    expect(passageAnnotationId(across)).toBe("p0002:8-p0004:4");
    expect(annotationAnchorId({ id: "p0002:8-p0004:4", range: across })).toBe("p0002");
    expect(annotationAnchorId({ id: "p0005" })).toBe("p0005");
  });

  it("parses stored passages and drops malformed anchors", () => {
    const stored = JSON.stringify([
      { id: "p0002:8-p0004:4", text: "想法", updatedAt: 1, range: across },
      { id: "bad-offset", text: "x", updatedAt: 1, range: { start: { paragraphId: "p0002", offset: -1 }, end: across.end } },
      { id: "bad-range", text: "x", updatedAt: 1, range: null },
    ]);
    expect(parseAnnotations(stored)).toEqual([
      { id: "p0002:8-p0004:4", text: "想法", updatedAt: 1, range: across },
    ]);
  });

  it("stores the range on a new passage note and keeps it through edits", () => {
    let list = upsertAnnotation([], "p0002:8-p0004:4", "初读", 1, across);
    list = upsertAnnotation(list, "p0002:8-p0004:4", "再读", 2);
    expect(list).toEqual([{ id: "p0002:8-p0004:4", text: "再读", updatedAt: 2, range: across }]);
  });

  it("quotes the source words, skipping apparatus between the ends", () => {
    expect(passageQuote(across, paragraphs, positions)).toBe("风停了。\n两位绅士");
  });

  it("quotes offsets in displayed text, where circled-marker breaks are folded", () => {
    const broken: Paragraph[] = [{ id: "p0002", kind: "prose", text: "绅士\n①\n站着。" }];
    const range: PassageRange = {
      start: { paragraphId: "p0002", offset: 0 },
      end: { paragraphId: "p0002", offset: 3 },
    };
    expect(passageQuote(range, broken, new Map([["p0002", 0]]))).toBe("绅士①");
  });

  it("marks each touched paragraph and closes the passage in the last one", () => {
    const annotations = [{ id: "p0002:8-p0004:4", text: "想法", updatedAt: 1, range: across }];
    const marks = passageMarks(annotations, paragraphs, positions);
    expect(marks.get("p0002")).toEqual([
      { annotationId: "p0002:8-p0004:4", from: 8, to: 12, closes: false },
    ]);
    expect(marks.has("p0003")).toBe(false);
    expect(marks.get("p0004")).toEqual([
      { annotationId: "p0002:8-p0004:4", from: 0, to: 4, closes: true },
    ]);
  });

  it("lists paragraph and passage notes together in reading order", () => {
    const annotations = [
      { id: "p0005", text: "末段", updatedAt: 3 },
      {
        id: "p0004:2-p0004:4",
        text: "绅士",
        updatedAt: 2,
        range: {
          start: { paragraphId: "p0004", offset: 2 },
          end: { paragraphId: "p0004", offset: 4 },
        },
      },
      { id: "p0004", text: "整段", updatedAt: 1 },
      { id: "p0404", text: "别的修订", updatedAt: 4 },
    ];
    expect(listAnnotations(annotations, paragraphs, positions)).toEqual([
      { id: "p0004", index: 3, note: "整段", excerpt: "两位绅士①站在门前。", updatedAt: 1 },
      { id: "p0004:2-p0004:4", index: 3, note: "绅士", excerpt: "「绅士」", updatedAt: 2 },
      { id: "p0005", index: 4, note: "末段", excerpt: "门上写着字。", updatedAt: 3 },
    ]);
  });

  it("clips excerpts to one line", () => {
    expect(clipText("第一行\n第二行", 5)).toBe("第一行 第…");
    expect(
      annotationExcerpt({ id: "p0002:8-p0004:4", range: across }, paragraphs, positions, 3),
    ).toBe("「风停了…」");
  });
});
