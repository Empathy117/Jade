import { describe, expect, it } from "vitest";

import {
  assetUrl,
  bookBaseUrl,
  coverUrl,
  findLibraryBook,
  sourceIllustrationUrl,
} from "./data";
import type { Asset, LibraryDocument, SourceIllustration } from "./types";

const library: LibraryDocument = {
  schema_version: 1,
  books: [
    {
      book_id: "fixture-book",
      path: "fixture book",
      title: "Fixture",
      author: null,
      summary: "A fixture.",
      cover: "assets/backgrounds/cover one.png",
      source_revision: 1,
      paragraph_count: 4,
      production: "manual",
    },
  ],
};

const asset: Asset = {
  id: "bg_fixture",
  type: "background",
  path: "assets/backgrounds/scene one.png",
  tags: ["fixture"],
  license: "CC0",
  source: "fixture",
  attribution: null,
};

const illustration: SourceIllustration = {
  id: "ill0001",
  at: "p0002",
  title: "Map",
  path: "source-assets/map one.png",
  media_type: "image/png",
  sha256: "0".repeat(64),
  source_href: "images/map one.png",
};

describe("multi-book data paths", () => {
  it("encodes each path segment without losing directories", () => {
    expect(bookBaseUrl("fixture book")).toBe("/fixture%20book");
    expect(assetUrl("fixture book", asset)).toBe(
      "/fixture%20book/assets/backgrounds/scene%20one.png",
    );
    expect(coverUrl(library.books[0])).toBe(
      "/fixture%20book/assets/backgrounds/cover%20one.png",
    );
    expect(sourceIllustrationUrl("fixture book", illustration)).toBe(
      "/fixture%20book/source-assets/map%20one.png",
    );
  });

  it("resolves direct links by path or stable book id", () => {
    expect(findLibraryBook(library, "fixture book")?.title).toBe("Fixture");
    expect(findLibraryBook(library, "fixture-book")?.title).toBe("Fixture");
    expect(findLibraryBook(library, "missing")).toBeNull();
    expect(findLibraryBook(library, null)).toBeNull();
  });
});
