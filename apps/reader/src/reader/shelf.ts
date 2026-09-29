import type { LibraryBook } from "./types";

/**
 * What the library shelf remembers about a book between visits: how far the
 * reader got and when they last turned a page. The shelf never loads a book's
 * source just to draw its card, so the Reader records this as it reads.
 */
export interface ShelfRecord {
  /** Source revision the percentage was measured against. */
  revision: number;
  percent: number;
  /** Milliseconds since the epoch. */
  readAt: number;
}

/** One card on the shelf, as the library screen draws it. */
export interface ShelfEntry {
  book: LibraryBook;
  /** Saved reading progress exists, so the card offers to continue. */
  continued: boolean;
  /** Known only once the book has been read since the shelf began recording. */
  percent: number | null;
  readAt: number | null;
}

/** Revision-independent, so the shelf still orders a re-imported book. */
export function shelfStorageKey(bookId: string): string {
  return `immersive-reader:${bookId}:shelf`;
}

export function parseShelfRecord(saved: string | null): ShelfRecord | null {
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as Partial<ShelfRecord> | null;
    if (
      typeof parsed?.revision !== "number" ||
      typeof parsed.percent !== "number" ||
      typeof parsed.readAt !== "number"
    ) {
      return null;
    }
    return { revision: parsed.revision, percent: parsed.percent, readAt: parsed.readAt };
  } catch {
    return null;
  }
}

/**
 * Resolve every card, most recently read first; books never recorded keep the
 * library's own order after them. A percentage measured against another source
 * revision is dropped, since its paragraphs no longer line up.
 */
export function shelfEntries(
  books: LibraryBook[],
  hasProgress: (book: LibraryBook) => boolean,
  recordFor: (book: LibraryBook) => ShelfRecord | null,
): ShelfEntry[] {
  const entries = books.map((book, order) => {
    const continued = hasProgress(book);
    const record = recordFor(book);
    const current = continued && record?.revision === book.source_revision;
    return {
      order,
      entry: {
        book,
        continued,
        percent: current ? record.percent : null,
        readAt: continued ? (record?.readAt ?? null) : null,
      },
    };
  });
  entries.sort(
    (left, right) =>
      (right.entry.readAt ?? -1) - (left.entry.readAt ?? -1) || left.order - right.order,
  );
  return entries.map(({ entry }) => entry);
}
