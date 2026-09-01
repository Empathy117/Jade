import { normalizeMarkerBreaks } from "./notes";
import type { Paragraph } from "./types";

const TARGET_BEAT_LENGTH = 120;
const MIN_BEAT_LENGTH = 72;
const MAX_BEAT_LENGTH = 180;
const STRONG_BREAK = new Set(["。", "！", "？", "!", "?", "；", ";", "\n"]);
const SOFT_BREAK = new Set(["，", ",", "、", "：", ":"]);
const CLOSING_MARK = new Set(["”", "’", "」", "』", "】", "》", "）", ")"]);

export interface ReadingBeat {
  text: string;
  index: number;
  total: number;
}

/**
 * Split one immutable source paragraph into short presentation-only pages.
 *
 * The returned text always concatenates back to the exact source text, except
 * that line breaks around circled note markers are folded away first — print
 * typography, not content. Source paragraph ids remain the only progress,
 * Director, note, and dossier anchors.
 */
export function readingBeats(paragraph: Paragraph): ReadingBeat[] {
  const text = normalizeMarkerBreaks(paragraph.text);
  const chunks =
    paragraph.kind === "title" || paragraph.kind === "chapter_heading"
      ? [text]
      : splitAtNaturalBreaks(text);
  const total = chunks.length;
  return chunks.map((text, index) => ({ text, index, total }));
}

export function splitAtNaturalBreaks(text: string): string[] {
  if (text.length <= MAX_BEAT_LENGTH) return [text];

  const characters = Array.from(text);
  const chunks: string[] = [];
  let start = 0;

  while (start < characters.length) {
    const hardEnd = Math.min(characters.length, start + MAX_BEAT_LENGTH);
    if (hardEnd === characters.length) {
      chunks.push(characters.slice(start).join(""));
      break;
    }

    const target = Math.min(hardEnd, start + TARGET_BEAT_LENGTH);
    let end = findForwardBreak(characters, target, hardEnd, STRONG_BREAK);
    end ??= findBackwardBreak(characters, hardEnd, start + MIN_BEAT_LENGTH, STRONG_BREAK);
    end ??= findBackwardBreak(characters, hardEnd, start + MIN_BEAT_LENGTH, SOFT_BREAK);
    end ??= hardEnd;
    end = includeClosingMarks(characters, end);

    chunks.push(characters.slice(start, end).join(""));
    start = end;
  }

  return chunks;
}

function findForwardBreak(
  characters: string[],
  start: number,
  end: number,
  breaks: ReadonlySet<string>,
): number | null {
  for (let index = start; index < end; index += 1) {
    if (breaks.has(characters[index])) return index + 1;
  }
  return null;
}

function findBackwardBreak(
  characters: string[],
  start: number,
  floor: number,
  breaks: ReadonlySet<string>,
): number | null {
  for (let index = start - 1; index >= floor; index -= 1) {
    if (breaks.has(characters[index])) return index + 1;
  }
  return null;
}

function includeClosingMarks(characters: string[], end: number): number {
  let resolved = end;
  while (resolved < characters.length && CLOSING_MARK.has(characters[resolved])) {
    resolved += 1;
  }
  return resolved;
}
