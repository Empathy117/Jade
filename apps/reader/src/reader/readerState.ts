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
): number {
  if (!guide?.start_at) return firstReadableIndex(source);
  const index = paragraphIndex(source).get(guide.start_at);
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
  source: SourceDocument,
  playback: PlaybackDocument,
  currentIndex: number,
): ResolvedPlaybackState {
  const positions = paragraphIndex(source);
  const resolved: ResolvedPlaybackState = {
    background: null,
    music: null,
    ambience: [],
    sceneId: null,
    cue: null,
  };

  for (const cue of playback.cues) {
    const cueIndex = positions.get(cue.at);
    if (cueIndex === undefined || cueIndex > currentIndex) {
      break;
    }
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
  source: SourceDocument,
  playback: PlaybackDocument,
  currentIndex: number,
  floorIndex = firstReadableIndex(source),
): number {
  const positions = paragraphIndex(source);
  let start = floorIndex;
  for (const cue of playback.cues) {
    const cueIndex = positions.get(cue.at);
    if (cueIndex === undefined || cueIndex > currentIndex) {
      break;
    }
    if (cue.clear_text) {
      start = cueIndex;
    }
  }
  return Math.min(start, currentIndex);
}

export function sceneAt(
  source: SourceDocument,
  direction: DirectionDocument,
  currentIndex: number,
): Scene | null {
  const positions = paragraphIndex(source);
  return (
    direction.scenes.find((scene) => {
      const start = positions.get(scene.start);
      const end = positions.get(scene.end);
      return start !== undefined && end !== undefined && start <= currentIndex && currentIndex <= end;
    }) ?? null
  );
}

export function progressStorageKey(source: SourceDocument): string {
  return `immersive-reader:${source.book_id}:revision-${source.revision}`;
}

export function progressIndex(source: SourceDocument, paragraphId: string | null): number {
  if (!paragraphId) {
    return firstReadableIndex(source);
  }
  return paragraphIndex(source).get(paragraphId) ?? firstReadableIndex(source);
}
