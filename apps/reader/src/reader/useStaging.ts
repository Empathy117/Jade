import { useCallback, useEffect, useMemo, useState } from "react";
import type { ParagraphPositions } from "./readerState";
import {
  cameraAt,
  gradeAt,
  IDENTITY_CAMERA,
  momentAt,
  pointKey,
  type CameraState,
  type ReadingPoint,
} from "./staging";
import type { BookBundle, GradeState, MomentCue } from "./types";

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

export interface Staging {
  camera: CameraState;
  grade: GradeState | null;
  moment: MomentRun | null;
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
  const [fired, setFired] = useState<ReadonlySet<string>>(() => new Set());
  const [holding, setHolding] = useState(false);
  const [chromeRevealed, setChromeRevealed] = useState(false);

  // Adjusted during render so the first frame at a new point already carries
  // its moment; an effect would paint one frame of the un-staged page first.
  if (bookId !== tracked.bookId) {
    setTracked({ bookId, key, serial: step.serial, stepped: false });
    setRun(null);
    setFired(new Set());
    setHolding(false);
  } else if (key !== tracked.key || step.serial !== tracked.serial) {
    const stepped = key !== tracked.key && step.serial !== tracked.serial;
    setTracked({ bookId, key, serial: step.serial, stepped });
    if (key !== tracked.key) {
      const cue = bundle ? momentAt(positions, bundle.playback, point) : null;
      if (cue && stepped && step.direction === 1 && !fired.has(cue.id)) {
        setRun({ cue, serial: (run?.serial ?? 0) + 1, active: true });
        setFired(new Set(fired).add(cue.id));
        setHolding((cue.params.hold_ms ?? 0) > 0);
        setChromeRevealed(false);
      } else if (run?.active) {
        setRun({ ...run, active: false });
        setHolding(false);
      }
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

  const active = run?.active ? run.cue : null;
  return {
    camera,
    grade,
    moment: run,
    stepped: tracked.stepped,
    chromeHidden: Boolean(active?.params.hide_chrome) && !chromeRevealed,
    isolating: active?.template === "isolate_line",
    musicGain: active?.template === "silence" ? (active.params.music_gain ?? 0) : 1,
    consumeHold,
    revealChrome,
  };
}
