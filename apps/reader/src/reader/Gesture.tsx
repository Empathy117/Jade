import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { GestureKind, Layout } from "./types";
import type { GestureRun } from "./useStaging";

interface GestureProps {
  run: GestureRun | null;
  layout: Layout;
  reducedMotion: boolean;
  hidden: boolean;
  /** Kinds already completed this session; their hint line stays hidden. */
  learned: ReadonlySet<GestureKind>;
  onComplete: (run: GestureRun) => void;
  viewportRef: React.RefObject<HTMLElement | null>;
}

/** Full turns of the ink stick that finish grinding. */
export const GRIND_TURNS = 2;
const INK_OPACITY = { pale: 0.42, normal: 0.72, deep: 0.92 } as const;

const HINTS: Record<GestureKind, string> = {
  grind_ink: "转动墨条",
  press_seal: "按下封印",
};
const LABELS: Record<GestureKind, string> = {
  grind_ink: "磨墨，可跳过",
  press_seal: "盖上封印，可跳过",
};

const STONE = { cx: 100, cy: 76, rx: 62, ry: 38 };

/** The signed change between two angles, wrapped into (-π, π]. */
function turn(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  return delta;
}

/**
 * One simple physical act the text describes (ADR-0007). It appears when a
 * forward page turn lands on its anchor, answers pointer input only inside
 * its own plate, completes on Enter, and never holds the page: turning on
 * leaves it finished and fading.
 */
export function Gesture({
  run,
  layout,
  reducedMotion,
  hidden,
  learned,
  onComplete,
  viewportRef,
}: GestureProps) {
  // Keep the last run after the reader moves on so it can fade out finished.
  const [shown, setShown] = useState(run);
  const [progress, setProgress] = useState(0);
  const [swirl, setSwirl] = useState(0);
  const [done, setDone] = useState(false);
  if (run && run !== shown) {
    if (run.serial !== shown?.serial) {
      setProgress(0);
      setSwirl(0);
      setDone(false);
    }
    setShown(run);
  }
  const visible = Boolean(run?.active) && !hidden;
  // Skipping by turning the page still closes the act the text describes.
  const finished = done || (shown !== null && !shown.active);

  const completedSerial = useRef(0);
  const complete = () => {
    if (!shown || !shown.active || completedSerial.current === shown.serial) return;
    completedSerial.current = shown.serial;
    setProgress(1);
    setDone(true);
    onComplete(shown);
  };

  const stoneRef = useRef<SVGEllipseElement | null>(null);
  const lastAngle = useRef<number | null>(null);
  const turned = useRef(0);
  useEffect(() => {
    turned.current = 0;
    lastAngle.current = null;
  }, [shown?.serial]);

  const angleAt = (event: React.PointerEvent) => {
    const rect = stoneRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!visible || finished) return;
    if (shown?.cue.kind === "press_seal" || reducedMotion) {
      complete();
      return;
    }
    lastAngle.current = angleAt(event);
    // Capture keeps a drag that leaves the plate grinding; it is a nicety,
    // and it throws for a pointer the browser no longer considers active.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Grinding still works while the pointer stays over the plate.
    }
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (lastAngle.current === null || finished) return;
    const angle = angleAt(event);
    if (angle === null) return;
    const delta = turn(lastAngle.current, angle);
    lastAngle.current = angle;
    turned.current += Math.abs(delta);
    setSwirl((value) => value + delta);
    const next = Math.min(1, turned.current / (GRIND_TURNS * 2 * Math.PI));
    setProgress(next);
    if (next >= 1) complete();
  };
  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    lastAngle.current = null;
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    complete();
  };

  const placement =
    shown?.cue.placement === "auto" || !shown
      ? layout === "adv"
        ? "above_text"
        : "lower"
      : shown.cue.placement;

  // Centred just above the adv text box, following its height.
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const [retry, setRetry] = useState(0);
  useLayoutEffect(() => {
    if (placement !== "above_text" || !visible) return;
    const viewport = viewportRef.current;
    if (!viewport) {
      const frame = window.requestAnimationFrame(() => setRetry((count) => count + 1));
      return () => window.cancelAnimationFrame(frame);
    }
    const measure = () => {
      const rect = viewport.getBoundingClientRect();
      setAnchor({ left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + 16 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [placement, retry, viewportRef, visible]);
  const placed = placement === "above_text" ? anchor : null;

  if (!shown) return null;
  const { kind, params } = shown.cue;
  const level = finished ? 1 : progress;
  const showHint = visible && !finished && !learned.has(kind);

  return (
    <div
      className={`gesture gesture--${kind} gesture--${placement}${visible ? " is-visible" : ""}${finished ? " is-finished" : ""}${reducedMotion ? " is-still" : ""}${placement === "above_text" && !placed ? " is-unplaced" : ""}`}
      style={placed ? { left: placed.left, bottom: placed.bottom } : undefined}
      data-interactive="true"
      role="button"
      tabIndex={visible && !finished ? 0 : -1}
      aria-label={LABELS[kind]}
      aria-hidden={!visible}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      {kind === "grind_ink" ? (
        <svg className="gesture__art" viewBox="0 0 200 140" aria-hidden="true">
          <ellipse className="gesture__stone" cx="100" cy="72" rx="86" ry="58" />
          <ellipse className="gesture__well" cx="100" cy="30" rx="38" ry="9" />
          <ellipse ref={stoneRef} className="gesture__face" {...STONE} />
          <ellipse
            className="gesture__ink"
            {...STONE}
            style={{ opacity: level * INK_OPACITY[params.tone ?? "normal"] }}
          />
          <ellipse
            className="gesture__ink gesture__ink--well"
            cx="100"
            cy="30"
            rx="38"
            ry="9"
            style={{ opacity: 0.15 + level * INK_OPACITY[params.tone ?? "normal"] * 0.8 }}
          />
          <g
            className="gesture__swirl"
            transform={`rotate(${((swirl * 180) / Math.PI).toFixed(1)} ${STONE.cx} ${STONE.cy})`}
          >
            <path d="M 72 76 A 28 17 0 0 1 128 76" />
            <path d="M 84 84 A 16 10 0 0 0 116 84" />
            <rect className="gesture__stick" x="114" y="68" width="22" height="12" rx="2" />
          </g>
          {params.direction && !finished ? (
            <path
              className="gesture__arrow"
              d={
                params.direction === "cw"
                  ? "M 24 78 A 78 50 0 0 1 176 70 l -6 -7 M 176 70 l -9 3"
                  : "M 176 78 A 78 50 0 0 0 24 70 l 6 -7 M 24 70 l 9 3"
              }
            />
          ) : null}
        </svg>
      ) : (
        <svg className="gesture__art" viewBox="0 0 200 140" aria-hidden="true">
          <rect className="gesture__paper" x="28" y="26" width="144" height="92" rx="2" />
          <path className="gesture__flap" d="M 28 28 L 100 78 L 172 28" />
          <circle className="gesture__target" cx="100" cy="80" r="16" />
          <g className="gesture__seal">
            <circle className="gesture__seal-body" cx="100" cy="80" r="15" />
            <path className="gesture__seal-mark" d="M 92 73 Q 100 70 108 74 M 94 81 L 106 79 M 96 88 Q 100 85 105 88" />
          </g>
        </svg>
      )}
      <span className={`gesture__hint${showHint ? " is-shown" : ""}`} aria-hidden="true">
        {HINTS[kind]}
      </span>
    </div>
  );
}
