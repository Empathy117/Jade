import { useCallback, useEffect, useMemo, useState } from "react";
import type { ParagraphPositions } from "./readerState";
import {
  atmosphereAt,
  cameraAt,
  cgAt,
  gestureAt,
  gradeAt,
  IDENTITY_CAMERA,
  instrumentAt,
  layoutAt,
  momentAt,
  NO_ATMOSPHERE,
  oneShotsAt,
  pointKey,
  trembleAt,
  type CameraState,
  type InstrumentReading,
  type OneShots,
  type ReadingPoint,
} from "./staging";
import type {
  AtmosphereState,
  BookBundle,
  CgCue,
  GestureCue,
  GradeState,
  Layout,
  MomentCue,
} from "./types";

/** The last page turn: its serial changes only when a turn actually moved. */
export interface ReadingStep {
  serial: number;
  direction: 1 | -1;
}

/** A moment that played, kept after it ends so its exit can fade out. */
export interface MomentRun {
  cue: MomentCue;
  /** Distinguishes consecutive runs so one-shot effects replay. */
  serial: number;
  active: boolean;
}

/** A gesture that arrived, kept after the reader moves on so it can close. */
export interface GestureRun {
  cue: GestureCue;
  /** Distinguishes consecutive runs so each starts unfinished. */
  serial: number;
  /** False once the reader has turned past it: it shows finished and fades. */
  active: boolean;
}

/** Sounds and effects that fired together; the serial replays nothing twice. */
export interface OneShotRun extends OneShots {
  serial: number;
}

export interface Staging {
  camera: CameraState;
  layout: Layout;
  atmosphere: AtmosphereState;
  cg: CgCue | null;
  instrument: InstrumentReading | null;
  oneShots: OneShotRun | null;
  /** Tremble intensity for the line on screen. */
  tremble: number;
  grade: GradeState | null;
  moment: MomentRun | null;
  gesture: GestureRun | null;
  /** The last move was a page turn, so the camera may travel; otherwise it settles. */
  stepped: boolean;
  chromeHidden: boolean;
  isolating: boolean;
  /** Multiplier on the resolved music gain; 1 leaves the score alone. */
  musicGain: number;
  /** Ends a pacing hold. Returns true when the turn was spent doing so. */
  consumeHold: () => boolean;
  revealChrome: () => void;
}

interface Tracked {
  bookId: string | null;
  key: string;
  serial: number;
  stepped: boolean;
}

/**
 * Resolve the stage for a reading point and run key moments.
 *
 * A moment plays once per session, and only when a forward page turn arrives
 * on its anchor: jumping onto it, paging back onto it, or resuming there never
 * replays it. Leaving the anchor in either direction ends it.
 */
export function useStaging(
  bundle: BookBundle | null,
  positions: ParagraphPositions,
  point: ReadingPoint,
  step: ReadingStep,
): Staging {
  const bookId = bundle?.source.book_id ?? null;
  const key = pointKey(point);
  const [tracked, setTracked] = useState<Tracked>({
    bookId,
    key,
    serial: step.serial,
    stepped: false,
  });
  const [run, setRun] = useState<MomentRun | null>(null);
  const [gesture, setGesture] = useState<GestureRun | null>(null);
  const [oneShots, setOneShots] = useState<OneShotRun | null>(null);
  const [fired, setFired] = useState<ReadonlySet<string>>(() => new Set());
  const [holding, setHolding] = useState(false);
  const [chromeRevealed, setChromeRevealed] = useState(false);

  // Adjusted during render so the first frame at a new point already carries
  // its moment; an effect would paint one frame of the un-staged page first.
  if (bookId !== tracked.bookId) {
    setTracked({ bookId, key, serial: step.serial, stepped: false });
    setRun(null);
    setGesture(null);
    setOneShots(null);
    setFired(new Set());
    setHolding(false);
  } else if (key !== tracked.key || step.serial !== tracked.serial) {
    const stepped = key !== tracked.key && step.serial !== tracked.serial;
    setTracked({ bookId, key, serial: step.serial, stepped });
    if (key !== tracked.key) {
      const forward = stepped && step.direction === 1;
      const nextFired = new Set(fired);
      if (bundle && forward) {
        const due = oneShotsAt(positions, bundle.playback, point);
        const sounds = due.sounds.filter((sound) => !fired.has(sound.id));
        const effects = due.effects.filter((effect) => !fired.has(`${key}:${effect.type}`));
        sounds.forEach((sound) => nextFired.add(sound.id));
        effects.forEach((effect) => nextFired.add(`${key}:${effect.type}`));
        if (sounds.length > 0 || effects.length > 0) {
          setOneShots({ sounds, effects, serial: (oneShots?.serial ?? 0) + 1 });
        }
      }
      const cue = bundle ? momentAt(positions, bundle.playback, point) : null;
      if (cue && forward && !fired.has(cue.id)) {
        nextFired.add(cue.id);
        setRun({ cue, serial: (run?.serial ?? 0) + 1, active: true });
        setHolding((cue.params.hold_ms ?? 0) > 0);
        setChromeRevealed(false);
      } else if (run?.active) {
        setRun({ ...run, active: false });
        setHolding(false);
      }
      // A gesture arrives like a moment: once, and only on a forward turn.
      const gestureCue = bundle ? gestureAt(positions, bundle.playback, point) : null;
      if (gestureCue && forward && !fired.has(gestureCue.id)) {
        nextFired.add(gestureCue.id);
        setGesture({ cue: gestureCue, serial: (gesture?.serial ?? 0) + 1, active: true });
      } else if (gesture?.active) {
        setGesture({ ...gesture, active: false });
      }
      if (nextFired.size !== fired.size) setFired(nextFired);
    }
  }

  const holdMs = run?.active ? (run.cue.params.hold_ms ?? 0) : 0;
  useEffect(() => {
    if (!holding || holdMs <= 0) return;
    const timeout = window.setTimeout(() => setHolding(false), holdMs);
    return () => window.clearTimeout(timeout);
  }, [holdMs, holding]);

  const consumeHold = useCallback(() => {
    if (!holding) return false;
    setHolding(false);
    return true;
  }, [holding]);
  const revealChrome = useCallback(() => setChromeRevealed(true), []);

  const camera = useMemo(
    () =>
      bundle ? cameraAt(bundle.source, positions, bundle.playback, point) : IDENTITY_CAMERA,
    // `point` is a fresh object each render; its key is the stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, positions, key],
  );
  const grade = useMemo(
    () => (bundle ? gradeAt(positions, bundle.playback, point) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, positions, key],
  );

  const presentation = useMemo(
    () =>
      bundle
        ? {
            layout: layoutAt(positions, bundle.playback, point),
            atmosphere: atmosphereAt(positions, bundle.playback, point),
            cg: cgAt(positions, bundle.playback, point),
            tremble: trembleAt(positions, bundle.playback, point),
            instrument: instrumentAt(positions, bundle.playback, point),
          }
        : {
            layout: "nvl" as const,
            atmosphere: NO_ATMOSPHERE,
            cg: null,
            tremble: 0,
            instrument: null,
          },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, positions, key],
  );

  const active = run?.active ? run.cue : null;
  return {
    ...presentation,
    oneShots,
    camera,
    grade,
    moment: run,
    gesture,
    stepped: tracked.stepped,
    chromeHidden: Boolean(active?.params.hide_chrome) && !chromeRevealed,
    isolating: active?.template === "isolate_line",
    musicGain: active?.template === "silence" ? (active.params.music_gain ?? 0) : 1,
    consumeHold,
    revealChrome,
  };
}
