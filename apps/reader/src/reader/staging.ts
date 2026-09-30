import { readingBeats } from "./readingBeats";
import type { ParagraphPositions } from "./readerState";
import type {
  AtmosphereState,
  CameraKey,
  CgCue,
  EffectCue,
  GestureCue,
  GradeState,
  InstrumentCue,
  InstrumentKey,
  Layout,
  MomentCue,
  PlaybackDocument,
  SoundCue,
  SourceDocument,
} from "./types";

/**
 * Reading-driven staging (ADR-0004).
 *
 * The camera, grade, and key moments are functions of where the reader is —
 * paragraph plus reading beat — never of wall-clock time, so paging back
 * rewinds them and a jump lands on exactly the state a reader would have
 * reached by paging there.
 */

export interface ReadingPoint {
  index: number;
  beat: number;
}

export interface CameraState {
  scale: number;
  x: number;
  y: number;
  blur: number;
  drift: number;
}

export const IDENTITY_CAMERA: CameraState = { scale: 1, x: 0, y: 0, blur: 0, drift: 0 };

export function pointKey(point: ReadingPoint): string {
  return `${point.index}:${point.beat}`;
}

export function comparePoints(a: ReadingPoint, b: ReadingPoint): number {
  return a.index - b.index || a.beat - b.beat;
}

function anchorPoint(
  positions: ParagraphPositions,
  anchor: { at: string; beat?: number },
): ReadingPoint | null {
  const index = positions.get(anchor.at);
  return index === undefined ? null : { index, beat: anchor.beat ?? 0 };
}

/**
 * A continuous reading coordinate: paragraph position plus the fraction of it
 * already read. Beats past a paragraph's last one count as its last beat.
 */
function readingOrdinal(source: SourceDocument, point: ReadingPoint): number {
  const beats = readingBeats(source.paragraphs[point.index]).length;
  return point.index + Math.min(point.beat, beats - 1) / beats;
}

/** Paragraph positions where a playback cue sets or clears the background. */
function backgroundBoundaries(positions: ParagraphPositions, playback: PlaybackDocument): number[] {
  const boundaries: number[] = [];
  for (const cue of playback.cues) {
    const index = positions.get(cue.at);
    if (index !== undefined && Object.hasOwn(cue, "background")) boundaries.push(index);
  }
  return boundaries;
}

function keyState(key: CameraKey): CameraState {
  return {
    scale: key.scale,
    x: key.x,
    y: key.y,
    blur: key.blur ?? 0,
    drift: key.drift ?? 0,
  };
}

/**
 * The framing at a reading point.
 *
 * Keys interpolate linearly by reading ordinal, but never across a background
 * change: a framing belongs to one image. A background with no key before the
 * reader starts from the identity framing and eases toward its first key.
 */
export function cameraAt(
  source: SourceDocument,
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): CameraState {
  const keys = playback.camera ?? [];
  if (keys.length === 0) return IDENTITY_CAMERA;

  const boundaries = backgroundBoundaries(positions, playback);
  const segmentStart = boundaries.filter((index) => index <= point.index).at(-1) ?? 0;
  const segmentEnd = boundaries.find((index) => index > point.index) ?? Infinity;

  let before: { point: ReadingPoint; state: CameraState } | null = null;
  let after: { point: ReadingPoint; state: CameraState } | null = null;
  for (const key of keys) {
    const keyPoint = anchorPoint(positions, key);
    if (!keyPoint || keyPoint.index < segmentStart || keyPoint.index >= segmentEnd) continue;
    if (comparePoints(keyPoint, point) <= 0) {
      before = { point: keyPoint, state: keyState(key) };
    } else {
      after = { point: keyPoint, state: keyState(key) };
      break;
    }
  }

  const start = before ?? { point: { index: segmentStart, beat: 0 }, state: IDENTITY_CAMERA };
  if (!after) return start.state;

  const from = readingOrdinal(source, start.point);
  const to = readingOrdinal(source, after.point);
  const t = to > from ? (readingOrdinal(source, point) - from) / (to - from) : 1;
  const mix = (a: number, b: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  return {
    scale: mix(start.state.scale, after.state.scale),
    x: mix(start.state.x, after.state.x),
    y: mix(start.state.y, after.state.y),
    blur: mix(start.state.blur, after.state.blur),
    // Idle drift belongs to the key being held, not to the move between keys.
    drift: start.state.drift,
  };
}

/**
 * The colour grade at a reading point: the latest cue grade or `grade_shift`
 * moment at or before it. A grade shift stays in force whether or not its
 * moment played, so jumping past one lands in the grade it set.
 */
export function gradeAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): GradeState | null {
  const entries: { point: ReadingPoint; grade: GradeState }[] = [];
  for (const cue of playback.cues) {
    const index = positions.get(cue.at);
    if (index !== undefined && cue.grade) entries.push({ point: { index, beat: 0 }, grade: cue.grade });
  }
  for (const moment of playback.moments ?? []) {
    const momentPoint = anchorPoint(positions, moment);
    if (momentPoint && moment.template === "grade_shift" && moment.params.grade) {
      entries.push({ point: momentPoint, grade: moment.params.grade });
    }
  }
  entries.sort((a, b) => comparePoints(a.point, b.point));

  let grade: GradeState | null = null;
  for (const entry of entries) {
    if (comparePoints(entry.point, point) > 0) break;
    grade = entry.grade;
  }
  return grade;
}

/** The moment anchored exactly at a reading point, if any. */
export function momentAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): MomentCue | null {
  for (const moment of playback.moments ?? []) {
    const momentPoint = anchorPoint(positions, moment);
    if (momentPoint && comparePoints(momentPoint, point) === 0) return moment;
  }
  return null;
}

/**
 * The latest value a cue sets for one state channel at or before a paragraph.
 * Like the background, a channel holds until a later cue changes it.
 */
function cueStateAt<K extends "layout" | "atmosphere">(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  index: number,
  channel: K,
): PlaybackDocument["cues"][number][K] | undefined {
  let value: PlaybackDocument["cues"][number][K] | undefined;
  for (const cue of playback.cues) {
    const cueIndex = positions.get(cue.at);
    if (cueIndex === undefined) continue;
    if (cueIndex > index) break;
    if (Object.hasOwn(cue, channel)) value = cue[channel];
  }
  return value;
}

export function layoutAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): Layout {
  return cueStateAt(positions, playback, point.index, "layout") ?? "nvl";
}

export const NO_ATMOSPHERE: AtmosphereState = { particles: null, density: 0, flicker: 0 };

export function atmosphereAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): AtmosphereState {
  return cueStateAt(positions, playback, point.index, "atmosphere") ?? NO_ATMOSPHERE;
}

/** The event art covering a reading point, if any. */
export function cgAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): CgCue | null {
  for (const cg of playback.cgs ?? []) {
    const start = anchorPoint(positions, cg);
    const end = anchorPoint(positions, { at: cg.until, beat: cg.until_beat });
    if (!start || !end) continue;
    if (comparePoints(start, point) <= 0 && comparePoints(point, end) <= 0) return cg;
  }
  return null;
}

export interface InstrumentReading {
  cue: InstrumentCue;
  key: InstrumentKey;
  /** The key before `key`, for rolling digits on a page turn. */
  previous: InstrumentKey | null;
  /**
   * A value that follows the reader between keys rather than holding: the
   * share of a letter already turned over (ADR-0009). Null for kinds whose
   * keys simply hold.
   */
  progress: number | null;
}

/**
 * The share of a letter turned over at a reading point (ADR-0009): reading
 * ordinal through its extent, from the start of the first paragraph to the end
 * of the last. The span is the extent when none is given.
 */
export function letterTurned(
  source: SourceDocument,
  positions: ParagraphPositions,
  cue: InstrumentCue,
  point: ReadingPoint,
): number {
  const extent = (cue.kind === "letter" && cue.extent) || cue;
  const start = positions.get(extent.at);
  const last = positions.get(extent.until);
  if (start === undefined || last === undefined || last < start) return 0;
  const turned = (readingOrdinal(source, point) - start) / (last + 1 - start);
  return Math.min(1, Math.max(0, turned));
}

/**
 * The instrument on screen at a reading point and the key in force. Before its
 * first key, a span shows that first key: the object is already there.
 */
export function instrumentAt(
  source: SourceDocument,
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): InstrumentReading | null {
  for (const cue of playback.instruments ?? []) {
    const start = anchorPoint(positions, cue);
    const end = anchorPoint(positions, { at: cue.until, beat: cue.until_beat });
    if (!start || !end) continue;
    if (comparePoints(point, start) < 0 || comparePoints(point, end) > 0) continue;
    let index = 0;
    cue.keys.forEach((key, keyIndex) => {
      const keyPoint = anchorPoint(positions, key);
      if (keyPoint && comparePoints(keyPoint, point) <= 0) index = keyIndex;
    });
    return {
      cue,
      key: cue.keys[index],
      previous: index > 0 ? cue.keys[index - 1] : null,
      progress: cue.kind === "letter" ? letterTurned(source, positions, cue, point) : null,
    };
  }
  return null;
}

/** The gesture anchored exactly at a reading point, if any. */
export function gestureAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): GestureCue | null {
  for (const gesture of playback.gestures ?? []) {
    const anchored = anchorPoint(positions, gesture);
    if (anchored && comparePoints(anchored, point) === 0) return gesture;
  }
  return null;
}

export interface OneShots {
  sounds: SoundCue[];
  effects: EffectCue[];
}

/**
 * Sounds and effects anchored exactly at a reading point. `tremble` is left
 * out: it is a state of the line on screen, not an event (see `trembleAt`).
 */
export function oneShotsAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): OneShots {
  const at = (anchor: { at: string; beat?: number }) => {
    const anchored = anchorPoint(positions, anchor);
    return anchored !== null && comparePoints(anchored, point) === 0;
  };
  return {
    sounds: (playback.sounds ?? []).filter(at),
    effects: (playback.effects ?? []).filter((effect) => effect.type !== "tremble" && at(effect)),
  };
}

/** Tremble intensity for the line at a reading point; 0 when it is still. */
export function trembleAt(
  positions: ParagraphPositions,
  playback: PlaybackDocument,
  point: ReadingPoint,
): number {
  for (const effect of playback.effects ?? []) {
    if (effect.type !== "tremble") continue;
    const anchored = anchorPoint(positions, effect);
    if (anchored && comparePoints(anchored, point) === 0) return effect.intensity;
  }
  return 0;
}

/**
 * CSS transform for a framing. Translation is bounded by the slack the scale
 * leaves, so `x: ±1` puts an image edge exactly on the viewport edge.
 */
export function cameraTransform(camera: CameraState): string {
  const slack = ((camera.scale - 1) / 2) * 100;
  const tx = -camera.x * slack;
  const ty = -camera.y * slack;
  return `translate(${round(tx)}%, ${round(ty)}%) scale(${round(camera.scale)})`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
