import { describe, expect, it } from "vitest";

import { resolveGuideReferences } from "./ReferenceGallery";
import type { GuideDocument, SourceDocument } from "./types";

const source: SourceDocument = {
  schema_version: 1,
  book_id: "fixture-book",
  revision: 1,
  title: "Fixture",
  language: "zh-CN",
  source: { format: "epub", path: "source.epub", sha256: "0".repeat(64) },
  paragraphs: [
    { id: "p0001", kind: "title", text: "Fixture" },
    { id: "p0002", kind: "prose", text: "Map" },
  ],
  illustrations: [
    {
      id: "ill0001",
      at: "p0002",
      title: "Map",
      path: "source-assets/map.png",
      media_type: "image/png",
      sha256: "1".repeat(64),
      source_href: "images/map.png",
    },
  ],
};

const guide: GuideDocument = {
  schema_version: 1,
  book_id: "fixture-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  references: [
    { id: "ref_map", illustration_id: "ill0001", title: "Story map" },
    { id: "ref_missing", illustration_id: "ill9999", title: "Missing" },
  ],
};

describe("reference gallery data", () => {
  it("resolves only guide-selected source illustrations", () => {
    expect(resolveGuideReferences(source, guide, "fixture book")).toEqual([
      {
        reference: guide.references?.[0],
        illustration: source.illustrations?.[0],
        src: "/fixture%20book/source-assets/map.png",
      },
    ]);
  });
});
