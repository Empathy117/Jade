import { describe, expect, it } from "vitest";

import {
  codexSeenStorageKey,
  locateOnMaps,
  unlockedAnchorPositions,
  unlockedCodex,
} from "./codex";
import type { CodexDocument, DirectionDocument, Scene } from "./types";

const PARAGRAPH_IDS = Array.from({ length: 20 }, (_, index) =>
  `p${String(index + 1).padStart(4, "0")}`,
);
// p0001 → 0, p0002 → 1, … mirrors paragraphIndex over a real source.
const positions = new Map(PARAGRAPH_IDS.map((id, index) => [id, index]));

function makeScene(overrides: Partial<Scene> & Pick<Scene, "id" | "start" | "end">): Scene {
  return {
    location: null,
    time: null,
    weather: null,
    mood: ["quiet"],
    tension: 0.2,
    label: undefined,
    ...overrides,
  };
}

const direction: DirectionDocument = {
  schema_version: 1,
  book_id: "test-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  scenes: [
    makeScene({
      id: "scene_001",
      start: "p0002",
      end: "p0009",
      location: "hall",
      label: "初到大宅",
    }),
    makeScene({ id: "scene_002", start: "p0010", end: "p0019", location: "attic" }),
  ],
};

const codex: CodexDocument = {
  schema_version: 1,
  book_id: "test-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  characters: [
    {
      id: "char_ann",
      name: "安",
      at: "p0003",
      role: "大宅的主人",
      group: "家族",
      aliases: [{ name: "安姐", at: "p0008" }],
      facts: [{ text: "常年独居。", at: "p0010" }],
      status: [
        { label: "死亡", kind: "dead", at: "p0012" },
        { label: "再生", kind: "undead", at: "p0014" },
      ],
    },
    { id: "char_ben", name: "本", at: "p0015", group: "家族" },
    { id: "char_dan", name: "丹", at: "p0016", group: "家族" },
    { id: "char_cat", name: "凯特", at: "p0005", group: "村镇", role: "邮差" },
    { id: "char_ghost", name: "幽灵", at: "p9999" },
  ],
  relationships: [
    { a: "char_ann", b: "char_ben", kind: "spouse", at: "p0002" },
    { a: "char_ann", b: "char_dan", kind: "parent", at: "p0002" },
    { a: "char_cat", b: "char_ann", kind: "lover", at: "p0011" },
  ],
  trees: [
    {
      id: "tree_family",
      title: "大宅家族",
      at: "p0002",
      nodes: [
        { character_id: "char_ann", row: 0, col: 0 },
        { character_id: "char_ben", row: 0, col: 2 },
        { character_id: "char_dan", row: 1, col: 1 },
      ],
    },
  ],
  places: [
    { id: "manor", name: "庄园", at: "p0011" },
    { id: "hall", name: "大厅", at: "p0004", parent: "manor", facts: [{ text: "挂着旧画像。", at: "p0009" }] },
    { id: "attic", name: "阁楼", at: "p0013" },
    { id: "cellar", name: "地窖", at: "p0007", parent: "hall" },
  ],
  maps: [
    {
      id: "map_manor",
      title: "大宅",
      at: "p0006",
      image: "codex-assets/manor.svg",
      width: 100,
      height: 80,
      markers: [
        { place_id: "hall", x: 10, y: 10 },
        { place_id: "attic", x: 50, y: 40 },
      ],
    },
  ],
};

const view = (furthestReadIndex: number) =>
  unlockedCodex(codex, direction, positions, furthestReadIndex);

describe("unlockedCodex", () => {
  it("shows nothing before any anchor is reached, and for a missing codex", () => {
    const locked = view(0);
    expect(locked.charactersById.size).toBe(0);
    expect(locked.hasPeople).toBe(false);
    expect(locked.hasAtlas).toBe(false);
    expect(unlockedCodex(null, direction, positions, 99).hasPeople).toBe(false);
  });

  it("reveals tree names at the tree anchor while keeping bios locked", () => {
    const early = view(1);
    expect(early.trees).toHaveLength(1);
    const ann = early.charactersById.get("char_ann");
    const ben = early.charactersById.get("char_ben");
    expect(ann?.appeared).toBe(false);
    expect(ben?.appeared).toBe(false);
    // Structure edges anchored at the diagram are visible with it.
    expect(early.trees[0].couples).toEqual([["char_ann", "char_ben"]]);
    expect(early.trees[0].parentLinks).toEqual([
      { parent: "char_ann", child: "char_dan" },
    ]);
    // Names on the diagram are known; nothing else about them is.
    expect(ann?.facts).toEqual([]);
    expect(ann?.currentStatus).toBeNull();
    expect(early.roster).toEqual([]);
  });

  it("keeps tree members out of the roster and groups the rest", () => {
    const mid = view(4);
    expect(mid.charactersById.get("char_ann")?.appeared).toBe(true);
    expect(mid.roster).toEqual([
      expect.objectContaining({ group: "村镇" }),
    ]);
    expect(mid.roster[0].members.map((member) => member.character.id)).toEqual([
      "char_cat",
    ]);
  });

  it("lists an appeared character in the roster while its tree is still locked", () => {
    const lateTree: CodexDocument = {
      ...codex,
      trees: [{ ...codex.trees![0], at: "p0018" }],
    };
    const early = unlockedCodex(lateTree, direction, positions, 4);
    expect(early.roster.map((group) => group.group)).toEqual(["家族", "村镇"]);
    expect(early.charactersById.has("char_ben")).toBe(false);
  });

  it("unlocks aliases, facts, and status by their own anchors", () => {
    const ann = view(13).charactersById.get("char_ann");
    expect(ann?.aliases.map((alias) => alias.name)).toEqual(["安姐"]);
    expect(ann?.facts.map((fact) => fact.text)).toEqual(["常年独居。"]);
    expect(ann?.status.map((status) => status.label)).toEqual(["死亡", "再生"]);
    expect(ann?.currentStatus?.kind).toBe("undead");
    expect(view(11).charactersById.get("char_ann")?.currentStatus?.kind).toBe("dead");
  });

  it("reveals relationships only once anchored and labels both perspectives", () => {
    const before = view(9);
    expect(
      before.charactersById.get("char_cat")?.relations,
    ).toEqual([]);

    const after = view(10);
    expect(after.charactersById.get("char_cat")?.relations).toEqual([
      { otherId: "char_ann", label: "恋人" },
    ]);
    expect(after.charactersById.get("char_ann")?.relations).toEqual(
      expect.arrayContaining([
        { otherId: "char_ben", label: "配偶" },
        { otherId: "char_dan", label: "子女" },
        { otherId: "char_cat", label: "恋人" },
      ]),
    );
    expect(after.charactersById.get("char_dan")?.relations).toEqual([
      { otherId: "char_ann", label: "长辈" },
    ]);
  });

  it("never shows a character whose anchor is unknown", () => {
    expect(view(19).charactersById.has("char_ghost")).toBe(false);
  });

  it("unlocks places and their read scenes, keeping unmapped places listed", () => {
    const beforeMap = view(4);
    expect(beforeMap.places.map((place) => place.place.id)).toEqual(["hall"]);
    expect(beforeMap.maps).toEqual([]);
    expect(beforeMap.unmappedPlaces.map((place) => place.place.id)).toEqual(["hall"]);
    expect(beforeMap.places[0].scenes).toEqual([
      { sceneId: "scene_001", label: "初到大宅", startId: "p0002" },
    ]);
    expect(beforeMap.hasAtlas).toBe(true);
  });

  it("unlocks a map whole and its markers per place", () => {
    const withMap = view(5);
    expect(withMap.maps).toHaveLength(1);
    expect(
      withMap.maps[0].markers.map((marker) => marker.marker.place_id),
    ).toEqual(["hall"]);
    expect(withMap.unmappedPlaces).toEqual([]);

    const withAttic = view(12);
    expect(
      withAttic.maps[0].markers.map((marker) => marker.marker.place_id),
    ).toEqual(["hall", "attic"]);
    // manor disappears (a marked place stands for its ancestors); cellar
    // stays listed because it is a child, not an ancestor, of a marked place.
    expect(withAttic.unmappedPlaces.map((place) => place.place.id)).toEqual(["cellar"]);
    // An unlabelled scene falls back to the place name.
    expect(withAttic.placesById.get("attic")?.scenes).toEqual([
      { sceneId: "scene_002", label: "阁楼", startId: "p0010" },
    ]);
  });
});

describe("locateOnMaps", () => {
  it("finds the current location's marker on an unlocked map", () => {
    expect(locateOnMaps(view(5), "hall")).toEqual({
      mapId: "map_manor",
      placeId: "hall",
    });
  });

  it("falls back to a marked ancestor for an unmapped room", () => {
    expect(locateOnMaps(view(6), "cellar")).toEqual({
      mapId: "map_manor",
      placeId: "hall",
    });
  });

  it("returns null without a location, a marker, or an unlocked map", () => {
    expect(locateOnMaps(view(5), null)).toBeNull();
    expect(locateOnMaps(view(5), "attic")).toBeNull();
    expect(locateOnMaps(view(4), "hall")).toBeNull();
  });
});

describe("freshness", () => {
  it("collects unlocked anchors so later ones read as new", () => {
    const anchors = unlockedAnchorPositions(codex, positions, 4);
    expect(Math.max(...anchors)).toBe(4);
    expect(anchors.some((anchor) => anchor > 3)).toBe(true);
    expect(anchors.some((anchor) => anchor > 4)).toBe(false);
  });

  it("ignores unknown anchors and a missing codex", () => {
    expect(unlockedAnchorPositions(codex, positions, 19)).not.toContain(
      Number.POSITIVE_INFINITY,
    );
    expect(unlockedAnchorPositions(null, positions, 19)).toEqual([]);
  });

  it("keys the seen watermark beside the progress key", () => {
    expect(codexSeenStorageKey("test-book", 2)).toBe(
      "immersive-reader:test-book:codex-seen:revision-2",
    );
  });
});
