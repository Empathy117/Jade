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
  /** v2: framing intent within the scene; the Reader plays resolved camera keys. */
  shots?: Shot[];
  /** v2: name of an entry in `DirectionDocument.grades`. */
  grade?: string;
  /** v2, visual_novel only. */
  layout?: Layout;
  atmosphere?: { particles?: ParticleKind; flicker?: "faint" | "unsteady" };
}

export type Layout = "nvl" | "adv";
export type ParticleKind = "dust";
export type EffectType = "shake" | "pulse" | "tremble";
export type PresentationProfile = "immersive" | "visual_novel";

export type ShotFraming = "wide" | "medium" | "close" | "detail";
export type ShotMove =
  | "hold"
  | "drift"
  | "push_in"
  | "pull_out"
  | "pan_left"
  | "pan_right"
  | "rack_focus";

export interface Shot {
  at: string;
  beat?: number;
  framing: ShotFraming;
  move: ShotMove;
  focus?: string;
}

export type MomentTemplate =
  | "letterbox_hold"
  | "isolate_line"
  | "silence"
  | "grade_shift"
  | "flash_cut"
  | "slow_reveal";

export interface DirectedMoment {
  id: string;
  at: string;
  beat?: number;
  template: MomentTemplate;
  intent: string;
  hold_ms?: number;
  grade?: string;
}

export interface GradeToken {
  tint: string;
  shade: number;
  saturation: number;
}

export interface DirectionDocument {
  schema_version: 1 | 2;
  book_id: string;
  source_revision: number;
  source_sha256: string;
  scenes: Scene[];
  grades?: Record<string, GradeToken>;
  moments?: DirectedMoment[];
  profile?: PresentationProfile;
}

export type AssetType = "background" | "music" | "ambience" | "cg" | "sfx";

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
  /** Background only: named regions as [x, y, width, height] fractions. */
  focal_points?: Record<string, [number, number, number, number]>;
  text_safe_area?: [number, number, number, number];
  min_scale_headroom?: number;
}

export interface AssetsDocument {
  schema_version: 1;
  catalog_id: string;
  assets: Asset[];
}

export type Transition = "cut" | "crossfade" | "iris" | "wipe";

export interface BackgroundCue {
  asset_id: string;
  transition: Transition;
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
  /** v2: colour grade from this paragraph on. */
  grade?: GradeState;
  /** v2, visual_novel only: text layout from this paragraph on. */
  layout?: Layout;
  /** v2, visual_novel only: particles and light flicker from this paragraph on. */
  atmosphere?: AtmosphereState;
}

export interface AtmosphereState {
  particles: ParticleKind | null;
  density: number;
  flicker: number;
}

export interface SoundCue {
  id: string;
  at: string;
  beat?: number;
  asset_id: string;
  gain: number;
  delay_ms?: number;
}

export interface EffectCue {
  at: string;
  beat?: number;
  type: EffectType;
  intensity: number;
  duration_ms?: number;
}

/** Event art shown from `at` through `until`, inclusive. */
export interface CgCue {
  id: string;
  at: string;
  beat?: number;
  until: string;
  until_beat?: number;
  asset_id: string;
  transition: Transition;
  duration_ms: number;
}

export interface GradeState extends GradeToken {
  duration_ms: number;
}

/**
 * A resolved camera framing at one reading position.
 *
 * `x` and `y` run from -1 to 1 and place the frame within the slack the scale
 * leaves: at `x: 1` the image's right edge meets the viewport's right edge, so
 * no framing can ever expose the stage behind the plate.
 */
export interface CameraKey {
  at: string;
  beat?: number;
  scale: number;
  x: number;
  y: number;
  blur?: number;
  /** Amplitude of the idle drift while this key holds, as a scale fraction. */
  drift?: number;
}

export interface MomentParams {
  in_ms?: number;
  out_ms?: number;
  hold_ms?: number;
  dim?: number;
  blur_px?: number;
  letterbox?: number;
  flash?: "white" | "black";
  music_gain?: number;
  grade?: GradeState;
  hide_chrome?: boolean;
}

export interface MomentCue {
  id: string;
  at: string;
  beat?: number;
  template: MomentTemplate;
  params: MomentParams;
}

export interface PlaybackDocument {
  schema_version: 1 | 2;
  book_id: string;
  source_revision: number;
  source_sha256: string;
  asset_catalog_id: string;
  cues: PlaybackCue[];
  camera?: CameraKey[];
  moments?: MomentCue[];
  sounds?: SoundCue[];
  effects?: EffectCue[];
  cgs?: CgCue[];
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
