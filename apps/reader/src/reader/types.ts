export type ParagraphKind =
  | "title"
  | "chapter_heading"
  | "prose"
  | "epigraph"
  | "note"
  | "nav";

export interface Paragraph {
  id: string;
  kind: ParagraphKind;
  text: string;
}

export interface SourceIllustration {
  id: string;
  at: string;
  title: string;
  path: string;
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  sha256: string;
  source_href: string;
}

export interface SourceDocument {
  schema_version: 1;
  book_id: string;
  revision: number;
  title: string;
  language: string;
  authors?: string[];
  source: {
    format: "txt" | "epub";
    path: string;
    sha256: string;
    encoding?: string;
  };
  paragraphs: Paragraph[];
  illustrations?: SourceIllustration[];
}

export interface GuideReference {
  id: string;
  illustration_id: string;
  title: string;
  note?: string;
}

export interface GuideDocument {
  schema_version: 1;
  book_id: string;
  source_revision: number;
  source_sha256: string;
  start_at?: string;
  references?: GuideReference[];
}

export interface CodexAlias {
  name: string;
  at: string;
}

export interface CodexRevealedText {
  text: string;
  at: string;
}

export type CodexStatusKind = "alive" | "dead" | "undead" | "missing" | "unknown";

export interface CodexStatusEntry {
  label: string;
  kind: CodexStatusKind;
  at: string;
}

export interface CodexCharacter {
  id: string;
  name: string;
  /** First-appearance anchor: unlocks the entry and is its jump target. */
  at: string;
  role?: string;
  group?: string;
  portrait?: string;
  aliases?: CodexAlias[];
  facts?: CodexRevealedText[];
  status?: CodexStatusEntry[];
}

export interface CodexRelationship {
  a: string;
  b: string;
  /** `spouse` and `parent` (a is the parent of b) also drive tree rendering. */
  kind: string;
  label?: string;
  at: string;
}

export interface CodexTreeNode {
  character_id: string;
  row: number;
  col: number;
}

export interface CodexTree {
  id: string;
  title: string;
  /** Where the book itself reveals the whole structure. */
  at: string;
  nodes: CodexTreeNode[];
}

export interface CodexPlace {
  /** Shares the direction.json location-tag namespace. */
  id: string;
  name: string;
  at: string;
  parent?: string;
  facts?: CodexRevealedText[];
}

export interface CodexMapMarker {
  place_id: string;
  x: number;
  y: number;
}

export interface CodexMap {
  id: string;
  title: string;
  at: string;
  image: string;
  width: number;
  height: number;
  source_illustration_id?: string;
  markers: CodexMapMarker[];
}

export interface CodexDocument {
  schema_version: 1;
  book_id: string;
  source_revision: number;
  source_sha256: string;
  characters?: CodexCharacter[];
  relationships?: CodexRelationship[];
  trees?: CodexTree[];
  places?: CodexPlace[];
  maps?: CodexMap[];
}

export interface Scene {
  id: string;
  label?: string;
  start: string;
  end: string;
  location: string | null;
  time: string | null;
  weather: string | null;
  mood: string[];
  tension: number;
}

export interface DirectionDocument {
  schema_version: 1;
  book_id: string;
  source_revision: number;
  source_sha256: string;
  scenes: Scene[];
}

export type AssetType = "background" | "music" | "ambience";

export interface Asset {
  id: string;
  title?: string;
  type: AssetType;
  path: string;
  tags: string[];
  license: string;
  source: string;
  attribution: string | null;
  loop?: boolean;
  duration_ms?: number;
}

export interface AssetsDocument {
  schema_version: 1;
  catalog_id: string;
  assets: Asset[];
}

export interface BackgroundCue {
  asset_id: string;
  transition: "cut" | "crossfade";
  duration_ms: number;
}

export interface MusicCue extends BackgroundCue {
  gain: number;
}

export interface AmbienceCue {
  asset_id: string;
  gain: number;
}

export interface PlaybackCue {
  at: string;
  scene_id: string;
  background?: BackgroundCue | null;
  music?: MusicCue | null;
  ambience?: AmbienceCue[];
  clear_text?: boolean;
}

export interface PlaybackDocument {
  schema_version: 1;
  book_id: string;
  source_revision: number;
  source_sha256: string;
  asset_catalog_id: string;
  cues: PlaybackCue[];
}

export interface BookBundle {
  source: SourceDocument;
  direction: DirectionDocument;
  assets: AssetsDocument;
  playback: PlaybackDocument;
  guide: GuideDocument | null;
  codex: CodexDocument | null;
}

export type BookProductionMode = "manual" | "agent-assisted" | "automated";

export interface LibraryBook {
  book_id: string;
  path: string;
  title: string;
  author: string | null;
  summary: string;
  cover: string;
  source_revision: number;
  paragraph_count: number;
  production: BookProductionMode;
}

export interface LibraryDocument {
  schema_version: 1;
  books: LibraryBook[];
}

export interface ResolvedPlaybackState {
  background: BackgroundCue | null;
  music: MusicCue | null;
  ambience: AmbienceCue[];
  sceneId: string | null;
  cue: PlaybackCue | null;
}
