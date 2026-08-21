import type { ParagraphPositions } from "./readerState";
import type {
  CodexAlias,
  CodexCharacter,
  CodexDocument,
  CodexMap,
  CodexMapMarker,
  CodexPlace,
  CodexRevealedText,
  CodexStatusEntry,
  CodexTree,
  CodexTreeNode,
  DirectionDocument,
} from "./types";

/**
 * The dossier's one rule: an atom is visible only once the furthest-read
 * position has passed its anchor. Nothing here may tell the reader anything
 * the text has not already said — no totals, no locked placeholders.
 */

export interface RelationView {
  otherId: string;
  label: string;
}

export interface CharacterView {
  character: CodexCharacter;
  /** The character's own first-appearance anchor has been read. */
  appeared: boolean;
  aliases: CodexAlias[];
  facts: CodexRevealedText[];
  status: CodexStatusEntry[];
  currentStatus: CodexStatusEntry | null;
  relations: RelationView[];
}

export interface TreeNodeView {
  node: CodexTreeNode;
  view: CharacterView;
}

export interface TreeView {
  tree: CodexTree;
  nodes: TreeNodeView[];
  /** Unlocked spouse pairs where both characters sit in this tree. */
  couples: Array<[string, string]>;
  /** Unlocked parent→child links where both characters sit in this tree. */
  parentLinks: Array<{ parent: string; child: string }>;
}

export interface SceneLink {
  sceneId: string;
  label: string;
  startId: string;
}

export interface PlaceView {
  place: CodexPlace;
  facts: CodexRevealedText[];
  /** Scenes at this location whose start the reader has passed. */
  scenes: SceneLink[];
}

export interface MarkerView {
  marker: CodexMapMarker;
  place: PlaceView;
}

export interface MapView {
  map: CodexMap;
  markers: MarkerView[];
}

export interface RosterGroup {
  group: string;
  members: CharacterView[];
}

export interface CodexView {
  charactersById: Map<string, CharacterView>;
  /** Appeared characters not shown inside any unlocked tree, grouped. */
  roster: RosterGroup[];
  trees: TreeView[];
  places: PlaceView[];
  placesById: Map<string, PlaceView>;
  maps: MapView[];
  /** Unlocked places that no unlocked map marks yet. */
  unmappedPlaces: PlaceView[];
  hasPeople: boolean;
  hasAtlas: boolean;
}

export const EMPTY_CODEX_VIEW: CodexView = {
  charactersById: new Map(),
  roster: [],
  trees: [],
  places: [],
  placesById: new Map(),
  maps: [],
  unmappedPlaces: [],
  hasPeople: false,
  hasAtlas: false,
};

const FALLBACK_GROUP = "其他";

export function unlockedCodex(
  codex: CodexDocument | null,
  direction: DirectionDocument,
  positions: ParagraphPositions,
  furthestReadIndex: number,
): CodexView {
  if (!codex) return EMPTY_CODEX_VIEW;

  // An anchor pointing at an unknown paragraph stays locked forever rather
  // than crashing the Reader; the pipeline validator reports it at build time.
  const position = (at: string): number =>
    positions.get(at) ?? Number.POSITIVE_INFINITY;
  const unlocked = (at: string): boolean => position(at) <= furthestReadIndex;
  const byAnchor = <T extends { at: string }>(entries: T[] | undefined): T[] =>
    (entries ?? [])
      .filter((entry) => unlocked(entry.at))
      .sort((left, right) => position(left.at) - position(right.at));

  const characters = codex.characters ?? [];
  const views = new Map<string, CharacterView>();
  for (const character of characters) {
    const status = byAnchor(character.status);
    views.set(character.id, {
      character,
      appeared: unlocked(character.at),
      aliases: byAnchor(character.aliases),
      facts: byAnchor(character.facts),
      status,
      currentStatus: status[status.length - 1] ?? null,
      relations: [],
    });
  }

  const trees = (codex.trees ?? []).filter((tree) => unlocked(tree.at));
  // The book's own diagram reveals structure and names at the tree anchor, so
  // every node is visible then — but a not-yet-appeared character shows only
  // its name and tree relations, never role, facts, or status.
  const structureRevealed = new Set(
    trees.flatMap((tree) => tree.nodes.map((node) => node.character_id)),
  );
  const visible = (characterId: string): boolean => {
    const view = views.get(characterId);
    return view !== undefined && (view.appeared || structureRevealed.has(characterId));
  };

  const relationships = (codex.relationships ?? []).filter(
    (relationship) =>
      unlocked(relationship.at) &&
      visible(relationship.a) &&
      visible(relationship.b),
  );
  for (const relationship of relationships) {
    const a = views.get(relationship.a);
    const b = views.get(relationship.b);
    if (!a || !b) continue;
    a.relations.push({
      otherId: relationship.b,
      label: relationLabel(relationship.kind, relationship.label, "a"),
    });
    b.relations.push({
      otherId: relationship.a,
      label: relationLabel(relationship.kind, relationship.label, "b"),
    });
  }

  const charactersById = new Map(
    [...views].filter(([characterId]) => visible(characterId)),
  );

  const treeViews: TreeView[] = trees.map((tree) => {
    const nodeIds = new Set(tree.nodes.map((node) => node.character_id));
    return {
      tree,
      nodes: tree.nodes.flatMap((node) => {
        const view = views.get(node.character_id);
        return view ? [{ node, view }] : [];
      }),
      couples: relationships
        .filter(
          (relationship) =>
            relationship.kind === "spouse" &&
            nodeIds.has(relationship.a) &&
            nodeIds.has(relationship.b),
        )
        .map((relationship): [string, string] => [relationship.a, relationship.b]),
      parentLinks: relationships
        .filter(
          (relationship) =>
            relationship.kind === "parent" &&
            nodeIds.has(relationship.a) &&
            nodeIds.has(relationship.b),
        )
        .map((relationship) => ({ parent: relationship.a, child: relationship.b })),
    };
  });

  const roster: RosterGroup[] = [];
  for (const character of characters) {
    const view = views.get(character.id);
    if (!view?.appeared || structureRevealed.has(character.id)) continue;
    const group = character.group ?? FALLBACK_GROUP;
    const existing = roster.find((entry) => entry.group === group);
    if (existing) {
      existing.members.push(view);
    } else {
      roster.push({ group, members: [view] });
    }
  }

  const places = (codex.places ?? []).filter((place) => unlocked(place.at));
  const placeViews: PlaceView[] = places.map((place) => ({
    place,
    facts: byAnchor(place.facts),
    scenes: direction.scenes
      .filter(
        (scene) =>
          scene.location === place.id &&
          position(scene.start) <= furthestReadIndex,
      )
      .map((scene) => ({
        sceneId: scene.id,
        label: scene.label ?? place.name,
        startId: scene.start,
      })),
  }));
  const placesById = new Map(placeViews.map((view) => [view.place.id, view]));

  const maps: MapView[] = (codex.maps ?? [])
    .filter((map) => unlocked(map.at))
    .map((map) => ({
      map,
      markers: map.markers.flatMap((marker) => {
        const place = placesById.get(marker.place_id);
        return place ? [{ marker, place }] : [];
      }),
    }));

  // A marked place represents its ancestors too — the building stands for the
  // cemetery around it — so only places with no marked descendant are listed
  // as awaiting a map.
  const mappedPlaceIds = new Set(
    maps.flatMap((map) => map.markers.map((marker) => marker.marker.place_id)),
  );
  const representedPlaceIds = new Set(mappedPlaceIds);
  for (const placeId of mappedPlaceIds) {
    let parent = placesById.get(placeId)?.place.parent;
    while (parent && !representedPlaceIds.has(parent)) {
      representedPlaceIds.add(parent);
      parent = placesById.get(parent)?.place.parent;
    }
  }
  const unmappedPlaces = placeViews.filter(
    (view) => !representedPlaceIds.has(view.place.id),
  );

  return {
    charactersById,
    roster,
    trees: treeViews,
    places: placeViews,
    placesById,
    maps,
    unmappedPlaces,
    hasPeople: charactersById.size > 0 || treeViews.length > 0,
    hasAtlas: maps.length > 0 || placeViews.length > 0,
  };
}

function relationLabel(
  kind: string,
  label: string | undefined,
  perspective: "a" | "b",
): string {
  if (label) return label;
  if (kind === "spouse") return "配偶";
  if (kind === "parent") return perspective === "a" ? "子女" : "长辈";
  if (kind === "lover") return "恋人";
  return kind;
}

export interface MapLocation {
  mapId: string;
  placeId: string;
}

/**
 * The first unlocked map carrying a marker for the given location tag.
 *
 * A location with no marker of its own falls back up its place parents, so
 * reading inside an unmapped room still lights the building that contains it.
 */
export function locateOnMaps(
  view: CodexView,
  location: string | null,
): MapLocation | null {
  const visited = new Set<string>();
  let placeId = location;
  while (placeId && !visited.has(placeId)) {
    visited.add(placeId);
    for (const map of view.maps) {
      const marked = map.markers.some(
        (marker) => marker.marker.place_id === placeId,
      );
      if (marked) return { mapId: map.map.id, placeId };
    }
    placeId = view.placesById.get(placeId)?.place.parent ?? null;
  }
  return null;
}

/**
 * Anchor positions of every unlocked dossier atom.
 *
 * Freshness compares these against the furthest-read position the reader had
 * when they last opened the dossier: anything later is new to them.
 */
export function unlockedAnchorPositions(
  codex: CodexDocument | null,
  positions: ParagraphPositions,
  furthestReadIndex: number,
): number[] {
  if (!codex) return [];
  const anchors: number[] = [];
  const collect = (at: string): void => {
    const index = positions.get(at);
    if (index !== undefined && index <= furthestReadIndex) anchors.push(index);
  };

  for (const character of codex.characters ?? []) {
    collect(character.at);
    for (const alias of character.aliases ?? []) collect(alias.at);
    for (const fact of character.facts ?? []) collect(fact.at);
    for (const status of character.status ?? []) collect(status.at);
  }
  for (const relationship of codex.relationships ?? []) collect(relationship.at);
  for (const tree of codex.trees ?? []) collect(tree.at);
  for (const place of codex.places ?? []) {
    collect(place.at);
    for (const fact of place.facts ?? []) collect(fact.at);
  }
  for (const map of codex.maps ?? []) collect(map.at);
  return anchors;
}

/**
 * Where the reader's dossier-seen watermark is stored.
 *
 * Keyed beside (not under) the progress key so stale-progress cleanup can keep
 * its own prefix; revisioned for the same reason progress is.
 */
export function codexSeenStorageKey(bookId: string, revision: number): string {
  return `immersive-reader:${bookId}:codex-seen:revision-${revision}`;
}
