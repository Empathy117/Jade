import { describe, expect, it } from "vitest";

import { isBookmarked, parseBookmarks, removeBookmark, toggleBookmark } from "./bookmarks";

describe("bookmarks", () => {
  it("parses saved bookmarks and drops malformed entries", () => {
    expect(parseBookmarks(null)).toEqual([]);
    expect(parseBookmarks("not json")).toEqual([]);
    expect(parseBookmarks('{"id":"p1"}')).toEqual([]);
    expect(
      parseBookmarks('[{"id":"p0004","createdAt":5},{"id":7},"junk"]'),
    ).toEqual([{ id: "p0004", createdAt: 5 }]);
  });

  it("toggles a paragraph in and out", () => {
    const added = toggleBookmark([], "p0004", 10);
    expect(added).toEqual([{ id: "p0004", createdAt: 10 }]);
    expect(isBookmarked(added, "p0004")).toBe(true);

    const removed = toggleBookmark(added, "p0004", 20);
    expect(removed).toEqual([]);
    expect(isBookmarked(removed, "p0004")).toBe(false);
  });

  it("removes only the requested bookmark", () => {
    const list = [
      { id: "p0002", createdAt: 1 },
      { id: "p0004", createdAt: 2 },
    ];
    expect(removeBookmark(list, "p0002")).toEqual([{ id: "p0004", createdAt: 2 }]);
  });
});
