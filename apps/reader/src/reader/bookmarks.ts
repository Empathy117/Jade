/**
 * Reader-made bookmarks: paragraph ids the reader chose to keep at hand.
 *
 * Stored per book and revision like progress — a re-import may renumber
 * paragraphs, so bookmarks never outlive the revision they were made in.
 */

export interface Bookmark {
  id: string;
  createdAt: number;
}

export function bookmarksStorageKey(bookId: string, sourceRevision: number): string {
  return `immersive-reader:${bookId}:bookmarks:revision-${sourceRevision}`;
}

/** Parse saved bookmarks, discarding anything that is not the expected shape. */
export function parseBookmarks(saved: string | null): Bookmark[] {
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is Bookmark =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Bookmark).id === "string" &&
        typeof (entry as Bookmark).createdAt === "number",
    );
  } catch {
    return [];
  }
}

export function isBookmarked(bookmarks: Bookmark[], paragraphId: string): boolean {
  return bookmarks.some((bookmark) => bookmark.id === paragraphId);
}

/** Add the paragraph when absent, remove it when present. */
export function toggleBookmark(
  bookmarks: Bookmark[],
  paragraphId: string,
  createdAt: number,
): Bookmark[] {
  if (isBookmarked(bookmarks, paragraphId)) {
    return bookmarks.filter((bookmark) => bookmark.id !== paragraphId);
  }
  return [...bookmarks, { id: paragraphId, createdAt }];
}

export function removeBookmark(bookmarks: Bookmark[], paragraphId: string): Bookmark[] {
  return bookmarks.filter((bookmark) => bookmark.id !== paragraphId);
}
