import type { Paragraph } from "./types";

export interface ChapterEntry {
  /** Paragraph index of the heading in the source document. */
  index: number;
  text: string;
}

/**
 * Chapter headings the reader has already reached, in book order.
 *
 * The list honours the same gating as everything else in the Reader: nothing
 * ahead of the furthest-read paragraph is revealed, and front matter skipped by
 * a preferred start stays hidden until the reader chooses to visit it.
 */
export function unlockedChapters(
  paragraphs: Paragraph[],
  floorIndex: number,
  furthestReadIndex: number,
): ChapterEntry[] {
  const chapters: ChapterEntry[] = [];
  const end = Math.min(furthestReadIndex, paragraphs.length - 1);
  // The chapter the floor sits inside has been reached even when a preferred
  // start skipped past its heading, so its heading is not a reveal.
  let start = Math.max(0, Math.min(floorIndex, paragraphs.length - 1));
  for (let index = start; index >= 0; index -= 1) {
    if (paragraphs[index].kind === "chapter_heading") {
      start = index;
      break;
    }
  }
  for (let index = start; index <= end; index += 1) {
    if (paragraphs[index].kind === "chapter_heading") {
      chapters.push({ index, text: paragraphs[index].text });
    }
  }
  return chapters;
}

/** The chapter the given position falls in, or null before the first heading. */
export function currentChapterIndex(
  chapters: ChapterEntry[],
  currentIndex: number,
): number | null {
  let current: number | null = null;
  for (const chapter of chapters) {
    if (chapter.index > currentIndex) break;
    current = chapter.index;
  }
  return current;
}
