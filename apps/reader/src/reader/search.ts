import { isFlowParagraph, normalizeMarkerBreaks } from "./notes";
import type { Paragraph } from "./types";

export interface SearchMatch {
  /** Paragraph index in the source document. */
  index: number;
  paragraphId: string;
  /** Displayed paragraph text the offsets below refer to. */
  text: string;
  /** First occurrence of the query inside `text`. */
  start: number;
  length: number;
  /** How often the query occurs in this paragraph. */
  occurrences: number;
}

export interface SearchResult {
  matches: SearchMatch[];
  /** Matching paragraphs in range, before the listing cap. */
  total: number;
}

export const EMPTY_SEARCH_RESULT: SearchResult = { matches: [], total: 0 };

/**
 * Find a phrase inside what the reader has already read.
 *
 * The Reader reveals nothing ahead of the furthest-read paragraph anywhere
 * else, and search honours the same boundary: only flow paragraphs between
 * the reading floor and the furthest-read position are examined, so a search
 * can never spoil what is still unread.
 */
export function searchReadParagraphs(
  paragraphs: Paragraph[],
  query: string,
  floorIndex: number,
  furthestReadIndex: number,
  limit = 80,
): SearchResult {
  const needle = query.trim().toLowerCase();
  if (!needle) return EMPTY_SEARCH_RESULT;

  const matches: SearchMatch[] = [];
  let total = 0;
  const end = Math.min(furthestReadIndex, paragraphs.length - 1);
  for (let index = Math.max(0, floorIndex); index <= end; index += 1) {
    const paragraph = paragraphs[index];
    if (!isFlowParagraph(paragraph)) continue;
    const text = normalizeMarkerBreaks(paragraph.text);
    const haystack = text.toLowerCase();
    const start = haystack.indexOf(needle);
    if (start === -1) continue;
    total += 1;
    if (matches.length >= limit) continue;
    let occurrences = 0;
    for (
      let cursor = start;
      cursor !== -1;
      cursor = haystack.indexOf(needle, cursor + needle.length)
    ) {
      occurrences += 1;
    }
    matches.push({
      index,
      paragraphId: paragraph.id,
      text,
      start,
      length: needle.length,
      occurrences,
    });
  }
  return { matches, total };
}

export interface SearchExcerpt {
  prefix: string;
  match: string;
  suffix: string;
}

/** A short window around the first hit, for the result list. */
export function searchExcerpt(match: SearchMatch, radius = 28): SearchExcerpt {
  const from = Math.max(0, match.start - radius);
  const to = Math.min(match.text.length, match.start + match.length + radius);
  return {
    prefix: `${from > 0 ? "…" : ""}${match.text.slice(from, match.start)}`,
    match: match.text.slice(match.start, match.start + match.length),
    suffix: `${match.text.slice(match.start + match.length, to)}${to < match.text.length ? "…" : ""}`,
  };
}
