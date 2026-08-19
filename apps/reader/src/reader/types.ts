export type ParagraphKind = "title" | "chapter_heading" | "prose" | "epigraph";

export interface Paragraph {
  id: string;
  kind: ParagraphKind;
  text: string;
}

export interface SourceDocument {
  schema_version: 1;
  book_id: string;
  revision: number;
  title: string;
  language: string;
  source: {
    format: "txt" | "epub";
    path: string;
    sha256: string;
  };
  paragraphs: Paragraph[];
}

export interface Scene {
  id: string;
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

export interface DemoBundle {
  source: SourceDocument;
  direction: DirectionDocument;
  assets: AssetsDocument;
  playback: PlaybackDocument;
}

export interface ResolvedPlaybackState {
  background: BackgroundCue | null;
  music: MusicCue | null;
  ambience: AmbienceCue[];
  sceneId: string | null;
  cue: PlaybackCue | null;
}
