import type {
  DirectionDocument,
  GuideDocument,
  PlaybackDocument,
  ResolvedPlaybackState,
  Scene,
  SourceDocument,
} from "./types";

export interface ReadingCursor {
  currentIndex: number;
  furthestReadIndex: number;
}

/**
 * Paragraph id to position in the source document.
 *
 * Building this walks the whole book, so callers hoist it once per bundle and
 * pass it into the per-paragraph lookups below.
 */
export type ParagraphPositions = ReadonlyMap<string, number>;

export function paragraphIndex(source: SourceDocument): Map<string, number> {
  return new Map(source.paragraphs.map((paragraph, index) => [paragraph.id, index]));
}

export function firstReadableIndex(source: SourceDocument): number {
  const index = source.paragraphs.findIndex((paragraph) => paragraph.kind !== "title");
  return index === -1 ? 0 : index;
}

export function preferredStartIndex(
  source: SourceDocument,
  guide: GuideDocument | null,
  positions: ParagraphPositions = paragraphIndex(source),
): number {
  if (!guide?.start_at) return firstReadableIndex(source);
  const index = positions.get(guide.start_at);
  if (index === undefined || source.paragraphs[index].kind === "title") {
    return firstReadableIndex(source);
  }
  return index;
}

export function clampParagraphIndex(source: SourceDocument, index: number): number {
  return Math.max(0, Math.min(index, source.paragraphs.length - 1));
}

export function moveReadingCursor(
  source: SourceDocument,
  cursor: ReadingCursor,
  targetIndex: number,
): ReadingCursor {
  const currentIndex = clampParagraphIndex(source, targetIndex);
  return {
    currentIndex,
    furthestReadIndex: Math.max(
      clampParagraphIndex(source, cursor.furthestReadIndex),
      currentIndex,
    ),
  };
}

export function resolvePlaybackAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  currentIndex: number,
): ResolvedPlaybackState {
  const resolved: ResolvedPlaybackState = {
    background: null,
    music: null,
    ambience: [],
    sceneId: null,
    cue: null,
  };

  for (const cue of playback.cues) {
    const cueIndex = positions.get(cue.at);
    // A cue anchored to an unknown paragraph is skipped rather than treated as
    // the end of the timeline, so one stale anchor cannot mute the whole book.
    if (cueIndex === undefined) continue;
    if (cueIndex > currentIndex) break;
    if (Object.hasOwn(cue, "background")) {
      resolved.background = cue.background ?? null;
    }
    if (Object.hasOwn(cue, "music")) {
      resolved.music = cue.music ?? null;
    }
    if (Object.hasOwn(cue, "ambience")) {
      resolved.ambience = cue.ambience ?? [];
    }
    resolved.sceneId = cue.scene_id;
    resolved.cue = cue;
  }
  return resolved;
}

export function visibleStartIndex(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  currentIndex: number,
  floorIndex: number,
): number {
  let start = floorIndex;
  for (const cue of playback.cues) {
    const cueIndex = positions.get(cue.at);
    if (cueIndex === undefined) continue;
    if (cueIndex > currentIndex) break;
    if (cue.clear_text) {
      start = cueIndex;
    }
  }
  return Math.min(Math.max(start, floorIndex), currentIndex);
}

/**
 * The background the next cue will switch to, if any.
 *
 * The Reader fetches this before the cue fires so a crossfade never starts
 * against a still-loading image.
 */
export function nextBackgroundAssetId(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  currentIndex: number,
): string | null {
  for (const cue of playback.cues) {
    const cueIndex = positions.get(cue.at);
    if (cueIndex === undefined || cueIndex <= currentIndex) continue;
    if (cue.background) return cue.background.asset_id;
  }
  return null;
}

export function sceneAt(
  positions: ParagraphPositions,
  direction: DirectionDocument,
  currentIndex: number,
): Scene | null {
  return (
    direction.scenes.find((scene) => {
      const start = positions.get(scene.start);
      const end = positions.get(scene.end);
      return start !== undefined && end !== undefined && start <= currentIndex && currentIndex <= end;
    }) ?? null
  );
}

/**
 * Where a book's furthest-read paragraph is stored.
 *
 * Keyed by revision so a re-imported source starts its own progress rather than
 * resuming at a paragraph id that may no longer mean the same thing.
 */
export function progressStorageKey(bookId: string, sourceRevision: number): string {
  return `immersive-reader:${bookId}:revision-${sourceRevision}`;
}

export function sourceProgressStorageKey(source: SourceDocument): string {
  return progressStorageKey(source.book_id, source.revision);
}

export function progressIndex(
  source: SourceDocument,
  paragraphId: string | null,
  positions: ParagraphPositions = paragraphIndex(source),
): number {
  if (!paragraphId) {
    return firstReadableIndex(source);
  }
  return positions.get(paragraphId) ?? firstReadableIndex(source);
}
