import { describe, expect, it } from "vitest";

import { annotationFor, parseAnnotations, upsertAnnotation } from "./annotations";

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
