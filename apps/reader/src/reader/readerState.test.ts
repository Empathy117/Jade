import { describe, expect, it } from "vitest";

import {
  moveReadingCursor,
  preferredStartIndex,
  progressIndex,
  resolvePlaybackAt,
  sceneAt,
  visibleStartIndex,
} from "./readerState";
import type {
  DirectionDocument,
  PlaybackDocument,
  SourceDocument,
} from "./types";

const source: SourceDocument = {
  schema_version: 1,
  book_id: "fixture-book",
  revision: 1,
  title: "Fixture",
  language: "zh-CN",
  source: { format: "txt", path: "source.txt", sha256: "0".repeat(64) },
  paragraphs: [
    { id: "p0001", kind: "title", text: "Fixture" },
    { id: "p0002", kind: "prose", text: "One" },
    { id: "p0003", kind: "prose", text: "Two" },
    { id: "p0004", kind: "prose", text: "Three" },
  ],
};

const direction: DirectionDocument = {
  schema_version: 1,
  book_id: "fixture-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  scenes: [
    {
      id: "scene_001",
      start: "p0002",
      end: "p0003",
      location: "forest",
      time: "night",
      weather: null,
      mood: ["quiet"],
      tension: 0.2,
    },
    {
      id: "scene_002",
      start: "p0004",
      end: "p0004",
      location: "room",
      time: "night",
      weather: null,
      mood: ["uneasy"],
      tension: 0.6,
    },
  ],
};

const playback: PlaybackDocument = {
  schema_version: 1,
  book_id: "fixture-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  asset_catalog_id: "fixture-assets",
  cues: [
    {
      at: "p0002",
      scene_id: "scene_001",
      background: { asset_id: "bg_forest", transition: "crossfade", duration_ms: 800 },
      music: {
        asset_id: "bgm_quiet",
        transition: "crossfade",
        duration_ms: 1000,
        gain: 0.2,
      },
    },
    {
      at: "p0004",
      scene_id: "scene_002",
      background: { asset_id: "bg_room", transition: "crossfade", duration_ms: 800 },
      clear_text: true,
    },
  ],
};

describe("reader state", () => {
  it("uses an optional guide start without changing source paragraph IDs", () => {
    expect(
      preferredStartIndex(source, {
        schema_version: 1,
        book_id: "fixture-book",
        source_revision: 1,
        source_sha256: "0".repeat(64),
        start_at: "p0003",
      }),
    ).toBe(2);
    expect(preferredStartIndex(source, null)).toBe(1);
  });

  it("reconstructs persisted playback channels at any paragraph", () => {
    const state = resolvePlaybackAt(source, playback, 3);
    expect(state.background?.asset_id).toBe("bg_room");
    expect(state.music?.asset_id).toBe("bgm_quiet");
    expect(state.sceneId).toBe("scene_002");
  });

  it("starts visible text at the latest clear cue", () => {
    expect(visibleStartIndex(source, playback, 2)).toBe(1);
    expect(visibleStartIndex(source, playback, 3)).toBe(3);
    expect(visibleStartIndex(source, playback, 2, 2)).toBe(2);
  });

  it("finds the semantic scene for a paragraph", () => {
    expect(sceneAt(source, direction, 2)?.id).toBe("scene_001");
    expect(sceneAt(source, direction, 3)?.id).toBe("scene_002");
  });

  it("falls back safely when saved progress is stale", () => {
    expect(progressIndex(source, "p9999")).toBe(1);
  });

  it("keeps the furthest reading position while reviewing history", () => {
    const reviewed = moveReadingCursor(
      source,
      { currentIndex: 3, furthestReadIndex: 3 },
      1,
    );
    expect(reviewed).toEqual({ currentIndex: 1, furthestReadIndex: 3 });

    const movedWithinHistory = moveReadingCursor(source, reviewed, 2);
    expect(movedWithinHistory).toEqual({
      currentIndex: 2,
      furthestReadIndex: 3,
    });
  });

  it("extends history only after reading beyond the previous frontier", () => {
    const advanced = moveReadingCursor(
      source,
      { currentIndex: 2, furthestReadIndex: 2 },
      3,
    );
    expect(advanced).toEqual({ currentIndex: 3, furthestReadIndex: 3 });
  });
});
