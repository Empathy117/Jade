import { describe, expect, it } from "vitest";

import { parseShelfRecord, shelfEntries } from "./shelf";
import type { ShelfRecord } from "./shelf";
import type { LibraryBook } from "./types";

function book(bookId: string, revision = 1): LibraryBook {
  return {
    book_id: bookId,
    path: bookId,
    title: bookId,
    author: null,
    summary: "",
    cover: "cover.jpg",
    source_revision: revision,
    paragraph_count: 10,
    production: "manual",
  };
}

describe("shelf records", () => {
  it("reads a saved record and rejects anything malformed", () => {
    expect(parseShelfRecord('{"revision":1,"percent":42,"readAt":5}')).toEqual({
      revision: 1,
      percent: 42,
      readAt: 5,
    });
    expect(parseShelfRecord(null)).toBeNull();
    expect(parseShelfRecord("not json")).toBeNull();
    expect(parseShelfRecord("null")).toBeNull();
    expect(parseShelfRecord('{"revision":1,"percent":"42","readAt":5}')).toBeNull();
  });

  it("puts the most recently read book first and keeps library order after", () => {
    const books = [book("a"), book("b"), book("c"), book("d")];
    const records: Record<string, ShelfRecord> = {
      b: { revision: 1, percent: 10, readAt: 100 },
      d: { revision: 1, percent: 80, readAt: 300 },
    };
    const entries = shelfEntries(
      books,
      (entry) => entry.book_id in records,
      (entry) => records[entry.book_id] ?? null,
    );

    expect(entries.map((entry) => entry.book.book_id)).toEqual(["d", "b", "a", "c"]);
    expect(entries[0]).toMatchObject({ continued: true, percent: 80, readAt: 300 });
    expect(entries[2]).toMatchObject({ continued: false, percent: null, readAt: null });
  });

  it("drops a percentage measured against another source revision", () => {
    const [entry] = shelfEntries(
      [book("a", 2)],
      () => true,
      () => ({ revision: 1, percent: 55, readAt: 9 }),
    );

    expect(entry).toMatchObject({ continued: true, percent: null, readAt: 9 });
  });

  it("ignores a record left behind once progress was cleared", () => {
    const [entry] = shelfEntries(
      [book("a")],
      () => false,
      () => ({ revision: 1, percent: 55, readAt: 9 }),
    );

    expect(entry).toMatchObject({ continued: false, percent: null, readAt: null });
  });
});
