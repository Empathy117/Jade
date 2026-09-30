import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FaceProps } from "./instrumentFace";
import { LetterFace } from "./LetterFace";
import { PianolaFace } from "./PianolaFace";
import { reactiveLevel, reactiveWaveform } from "./reactiveBus";
import type { InstrumentReading } from "./staging";
import type { InstrumentKey, Layout, LetterKey, PianolaKey, RadioKey, WindKey } from "./types";
import { BEARING, flowBearing, nearestTurn } from "./wind";

interface InstrumentProps {
  reading: InstrumentReading | null;
  /** The last move was a page turn; a jump lands on the new reading at once. */
  stepped: boolean;
  layout: Layout;
  reducedMotion: boolean;
  /** Sound is audible, so the instrument may react to it. */
  reactive: boolean;
  /** Event art is on screen; the instrument steps back. */
  dimmed: boolean;
  hidden: boolean;
  viewportRef: React.RefObject<HTMLElement | null>;
}

/** States in which an instrument rests, each with the class that quiets its plate. */
const RESTING: Partial<Record<InstrumentKey["state"], string>> = {
  off: " is-off",
  calm: " is-calm",
  set_down: " is-set-down",
  closed: " is-closed",
  dismantled: " is-dismantled",
};

/**
 * The instrument channel's shell (ADR-0006): it fades a panel in and out with
 * its span, places it for the layout, and dims it under event art. What the
 * panel shows belongs to its kind's face.
 */
export function Instrument({
  reading,
  stepped,
  layout,
  reducedMotion,
  reactive,
  dimmed,
  hidden,
  viewportRef,
}: InstrumentProps) {
  // Keep the last reading after a span ends so the panel can fade out whole.
  const [shown, setShown] = useState(reading);
  if (reading && reading !== shown) setShown(reading);
  const visible = Boolean(reading) && !hidden;
  // Placement follows the layout only while visible, so a panel fading out as
  // its scene ends does not jump to where the next scene would put it.
  const [placedLayout, setPlacedLayout] = useState(layout);
  if (visible && layout !== placedLayout) setPlacedLayout(layout);

  const placement =
    shown?.cue.placement === "auto" || !shown
      ? placedLayout === "adv"
        ? "above_text"
        : "top_right"
      : shown.cue.placement;

  // Above the adv text box, right-aligned with it, following its height.
  const [anchor, setAnchor] = useState<{ right: number; bottom: number } | null>(null);
  const [retry, setRetry] = useState(0);
  useLayoutEffect(() => {
    // Stop measuring once hidden: a fading panel keeps its last position.
    if (placement !== "above_text" || !visible) return;
    const viewport = viewportRef.current;
    if (!viewport) {
      // The text box mounts after the reader starts; look again next frame.
      const frame = window.requestAnimationFrame(() => setRetry((count) => count + 1));
      return () => window.cancelAnimationFrame(frame);
    }
    const measure = () => {
      const rect = viewport.getBoundingClientRect();
      setAnchor({ right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 12 });
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

  // A stale measurement from an earlier adv scene must not place an nvl panel.
  const placed = placement === "above_text" ? anchor : null;

  if (!shown) return null;
  const face = { stepped, reducedMotion, reactive, visible };
  const state = shown.key.state;

  return (
    <div
      className={`instrument instrument--${shown.cue.kind} instrument--${placement}${visible ? " is-visible" : ""}${dimmed ? " is-dimmed" : ""}${RESTING[state] ?? ""}${placement === "above_text" && !placed ? " is-unplaced" : ""}`}
      style={placed ? { right: placed.right, bottom: placed.bottom } : undefined}
      aria-hidden="true"
    >
      {shown.cue.kind === "wind" ? (
        <WindFace windKey={shown.key as WindKey} {...face} />
      ) : shown.cue.kind === "letter" ? (
        <LetterFace letterKey={shown.key as LetterKey} turned={shown.progress ?? 0} {...face} />
      ) : shown.cue.kind === "pianola" ? (
        <PianolaFace pianolaKey={shown.key as PianolaKey} seed={shown.cue.id} {...face} />
      ) : (
        <RadioFace radioKey={shown.key as RadioKey} {...face} />
      )}
    </div>
  );
}

// The S-meter sweeps 110°, from S1 at the left stop to +20 dB at the right.
const SWEEP = 55;
const METER = { width: 220, height: 74, pivotX: 110, pivotY: 84, radius: 70 };
const TICKS: [number, string][] = [
  [0.05, "1"],
  [0.25, "3"],
  [0.45, "5"],
  [0.62, "7"],
  [0.8, "9"],
  [1, "+20"],
];
const ROLL_MS = 700;

function needleAngle(value: number): number {
  return -SWEEP + Math.min(1, Math.max(0, value)) * SWEEP * 2;
}

function polar(value: number, radius: number): [number, number] {
  const radians = ((needleAngle(value) - 90) * Math.PI) / 180;
  return [METER.pivotX + radius * Math.cos(radians), METER.pivotY + radius * Math.sin(radians)];
}

function decimals(frequency: string): number {
  return frequency.split(".").slice(1).reduce((sum, part) => sum + part.length, 0);
}

function formatFrequency(value: number, places: number): string {
  return value.toFixed(Math.min(places, 3));
}

const BLANK = "--.---";

/**
 * A radio's front panel (ADR-0006): frequency digits, an S-meter needle, a
 * transmit lamp, and one trace of what the speaker is carrying. Every value
 * comes from playback keys; the only live input is the loudness of the
 * scene's sounds, which makes the needle tremble and the trace move.
 */
function RadioFace({ radioKey: key, stepped, reducedMotion, reactive, visible }: FaceProps & { radioKey: RadioKey }) {
  const needleRef = useRef<SVGGElement | null>(null);
  const digitsRef = useRef<HTMLSpanElement | null>(null);
  const traceRef = useRef<HTMLCanvasElement | null>(null);
  const motion = useRef({ needle: 0, velocity: 0, roll: null as null | { from: number; to: number; places: number; start: number } });
  const lastKey = useRef<RadioKey | null>(null);

  // A new key: roll the digits on a tuning page turn, snap everything on a jump.
  // The digits are written here and by the frame loop only, never by React, so
  // a roll in progress is never overwritten by a re-render.
  useLayoutEffect(() => {
    if (key === lastKey.current) return;
    const previous = lastKey.current;
    lastKey.current = key;
    const state = motion.current;
    const from = previous?.frequency ? Number(previous.frequency) : NaN;
    const to = key.frequency ? Number(key.frequency) : NaN;
    state.roll =
      stepped && !reducedMotion && key.tuning && Number.isFinite(from) && Number.isFinite(to) && from !== to
        ? { from, to, places: decimals(key.frequency!), start: performance.now() }
        : null;
    if (!stepped || reducedMotion || !previous) {
      state.needle = key.signal;
      state.velocity = 0;
    }
    if (digitsRef.current && !state.roll) digitsRef.current.textContent = key.frequency ?? BLANK;
  }, [key, reducedMotion, stepped]);

  // The panel's life: needle physics, digit roll, and the trace, per frame.
  useEffect(() => {
    if (!visible) return;
    const draw = (level: number, wave: Float32Array | null) => {
      const state = motion.current;
      needleRef.current?.setAttribute(
        "transform",
        `rotate(${needleAngle(state.needle).toFixed(2)} ${METER.pivotX} ${METER.pivotY})`,
      );
      const canvas = traceRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== canvas.clientWidth * ratio) {
        canvas.width = canvas.clientWidth * ratio;
        canvas.height = canvas.clientHeight * ratio;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (key.state === "off") return;
      const mid = canvas.height / 2;
      // Samples arrive normalised to the recent peak; noise sets how wild the
      // trace may get, the live level how much it moves right now.
      const gain = (0.25 + key.noise) * (0.3 + 0.7 * level);
      context.beginPath();
      const points = 96;
      for (let index = 0; index <= points; index += 1) {
        const x = (index / points) * canvas.width;
        const sample = wave ? wave[Math.floor((index / points) * (wave.length - 1))] : 0;
        const y = mid - Math.max(-1, Math.min(1, sample * gain)) * (mid - ratio);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = "rgba(236, 196, 120, 0.8)";
      context.lineWidth = ratio;
      context.stroke();
    };

    if (reducedMotion) {
      motion.current.needle = key.signal;
      draw(0, null);
      return;
    }

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const state = motion.current;
      const level = reactive ? reactiveLevel() : 0;
      // Static kicks the needle; a clean signal lets it settle.
      const jitter = key.noise * level * (0.35 + 0.25 * Math.sin(now / 37) * Math.sin(now / 91));
      const target = Math.min(1, key.signal + jitter);
      // A damped spring: a real meter overshoots a little, then settles.
      state.velocity += ((target - state.needle) * 90 - state.velocity * 13) * dt;
      state.needle += state.velocity * dt;
      if (state.roll && digitsRef.current) {
        const t = Math.min(1, (now - state.roll.start) / ROLL_MS);
        const eased = 1 - (1 - t) ** 3;
        const value = state.roll.from + (state.roll.to - state.roll.from) * eased;
        digitsRef.current.textContent = formatFrequency(value, state.roll.places);
        if (t >= 1) {
          digitsRef.current.textContent = key.frequency ?? BLANK;
          state.roll = null;
        }
      }
      draw(level, reactive ? reactiveWaveform() : null);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [key, reactive, reducedMotion, visible]);

  return (
    <>
      <div className="instrument__readout">
        <span className="instrument__digits" ref={digitsRef} />
        <span className="instrument__unit">MHz</span>
        <span className={`instrument__lamp${key.tx ? " is-lit" : ""}`}>TX</span>
      </div>
      <svg className="instrument__meter" viewBox={`0 0 ${METER.width} ${METER.height}`}>
        <path
          className="instrument__arc"
          d={`M ${polar(0, METER.radius).join(" ")} A ${METER.radius} ${METER.radius} 0 0 1 ${polar(1, METER.radius).join(" ")}`}
        />
        <path
          className="instrument__arc instrument__arc--over"
          d={`M ${polar(0.8, METER.radius).join(" ")} A ${METER.radius} ${METER.radius} 0 0 1 ${polar(1, METER.radius).join(" ")}`}
        />
        {TICKS.map(([value, label]) => {
          const [x1, y1] = polar(value, METER.radius);
          const [x2, y2] = polar(value, METER.radius - 6);
          const [lx, ly] = polar(value, METER.radius + 9);
          return (
            <g key={label}>
              <line className="instrument__tick" x1={x1} y1={y1} x2={x2} y2={y2} />
              <text className="instrument__label" x={lx} y={ly}>
                {label}
              </text>
            </g>
          );
        })}
        <text className="instrument__label instrument__label--s" x={polar(0, METER.radius + 9)[0] - 12} y={polar(0, METER.radius + 9)[1]}>
          S
        </text>
        <g ref={needleRef} transform={`rotate(${needleAngle(key.signal)} ${METER.pivotX} ${METER.pivotY})`}>
          <line className="instrument__needle" x1={METER.pivotX} y1={METER.pivotY} x2={METER.pivotX} y2={METER.pivotY - METER.radius + 2} />
        </g>
      </svg>
      <canvas className="instrument__trace" ref={traceRef} />
    </>
  );
}

// A compass dial on the left, five strength bars on the right.
const WIND = { width: 220, height: 82, cx: 44, cy: 41, radius: 33 };
const BARS = [0, 1, 2, 3, 4].map((index) => ({
  x: 104 + index * 22,
  height: 12 + index * 12,
}));
const BAR_BASE = 70;
const STREAKS = [
  { x: -12, phase: 0 },
  { x: 6, phase: 0.35 },
  { x: -3, phase: 0.62 },
  { x: 14, phase: 0.85 },
];
const STREAK_LENGTH = 11;

/**
 * The wind (ADR-0008): an arrow across a compass dial showing where it blows,
 * streaks drifting along it, and a bar of five segments for its strength. The
 * direction appears only when the text names one; gusts in the scene's sounds
 * swing the arrow and flicker the bar.
 */
function WindFace({ windKey: key, stepped, reducedMotion, reactive, visible }: FaceProps & { windKey: WindKey }) {
  const arrowRef = useRef<SVGGElement | null>(null);
  const streakRefs = useRef<(SVGLineElement | null)[]>([]);
  const barRefs = useRef<(SVGRectElement | null)[]>([]);
  const motion = useRef({ angle: 0, velocity: 0, strength: 0, drift: 0 });
  const lastKey = useRef<WindKey | null>(null);
  const hasArrow = Boolean(key.from) && key.state !== "calm";

  const paint = (angle: number, strength: number, drift: number) => {
    arrowRef.current?.setAttribute("transform", `rotate(${angle.toFixed(2)} ${WIND.cx} ${WIND.cy})`);
    barRefs.current.forEach((bar, index) => {
      // Each segment lights as the strength passes its share, softly at the edge.
      const lit = Math.min(1, Math.max(0, strength * BARS.length - index));
      bar?.style.setProperty("--lit", lit.toFixed(3));
    });
    streakRefs.current.forEach((streak, index) => {
      if (!streak) return;
      const along = ((drift + STREAKS[index].phase) % 1) * (WIND.radius * 2) - WIND.radius;
      // Streaks fade in and out at the rim of the dial.
      const edge = 1 - Math.abs(along) / WIND.radius;
      streak.setAttribute("y1", (WIND.cy - along).toFixed(2));
      streak.setAttribute("y2", (WIND.cy - along + STREAK_LENGTH).toFixed(2));
      streak.style.opacity = (Math.max(0, edge) * 0.55 * Math.min(1, strength * 1.6)).toFixed(3);
    });
  };

  // A new key: swing the short way on a page turn, set at once on a jump.
  useLayoutEffect(() => {
    if (key === lastKey.current) return;
    const previous = lastKey.current;
    lastKey.current = key;
    const state = motion.current;
    const target = key.from ? flowBearing(key.from) : state.angle;
    if (!stepped || reducedMotion || !previous || !previous.from) {
      state.angle = key.from ? nearestTurn(state.angle, target) : state.angle;
      state.velocity = 0;
      state.strength = key.strength;
    }
    paint(state.angle, state.strength, state.drift);
  }, [key, reducedMotion, stepped]);

  useEffect(() => {
    if (!visible || reducedMotion) {
      const state = motion.current;
      if (key.from) state.angle = nearestTurn(state.angle, flowBearing(key.from));
      state.strength = key.strength;
      paint(state.angle, state.strength, 0.5);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const state = motion.current;
      const level = reactive && key.state !== "calm" ? reactiveLevel() : 0;
      const gust = key.gust * level;
      // Gusts swing the vane a few degrees either side of the wind's line.
      const sway = gust * 14 * Math.sin(now / 173) * Math.sin(now / 61);
      const target = key.from ? nearestTurn(state.angle, flowBearing(key.from)) + sway : state.angle;
      // A damped spring, heavier than the radio's needle: a vane swings, then settles.
      state.velocity += ((target - state.angle) * 22 - state.velocity * 7) * dt;
      state.angle += state.velocity * dt;
      // Strength eases toward the key, and gusts push it up for a moment.
      const strengthTarget = Math.min(1, key.strength + gust * 0.25);
      state.strength += (strengthTarget - state.strength) * Math.min(1, dt * 4);
      state.drift = (state.drift + dt * (0.12 + state.strength * 0.9)) % 1;
      paint(state.angle, state.strength, state.drift);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [key, reactive, reducedMotion, visible]);

  const ticks = Object.values(BEARING);

  return (
    <svg className="instrument__wind" viewBox={`0 0 ${WIND.width} ${WIND.height}`}>
      <defs>
        <clipPath id="instrument-wind-dial">
          <circle cx={WIND.cx} cy={WIND.cy} r={WIND.radius - 3} />
        </clipPath>
      </defs>
      <circle className="instrument__dial" cx={WIND.cx} cy={WIND.cy} r={WIND.radius} />
      {ticks.map((bearing) => {
        const radians = ((bearing - 90) * Math.PI) / 180;
        const inner = bearing % 90 === 0 ? WIND.radius - 6 : WIND.radius - 3;
        return (
          <line
            key={bearing}
            className="instrument__tick"
            x1={WIND.cx + WIND.radius * Math.cos(radians)}
            y1={WIND.cy + WIND.radius * Math.sin(radians)}
            x2={WIND.cx + inner * Math.cos(radians)}
            y2={WIND.cy + inner * Math.sin(radians)}
          />
        );
      })}
      <text className="instrument__label instrument__label--north" x={WIND.cx} y={WIND.cy - WIND.radius - 3}>
        N
      </text>
      <circle className="instrument__hub" cx={WIND.cx} cy={WIND.cy} r={1.6} />
      <g className={`instrument__vane${hasArrow ? " is-shown" : ""}`} ref={arrowRef}>
        <g clipPath="url(#instrument-wind-dial)">
          {STREAKS.map((streak, index) => (
            <line
              key={streak.phase}
              className="instrument__streak"
              ref={(element) => {
                streakRefs.current[index] = element;
              }}
              x1={WIND.cx + streak.x}
              x2={WIND.cx + streak.x}
              y1={WIND.cy}
              y2={WIND.cy + STREAK_LENGTH}
            />
          ))}
        </g>
        <line className="instrument__arrow" x1={WIND.cx} y1={WIND.cy + WIND.radius - 8} x2={WIND.cx} y2={WIND.cy - WIND.radius + 9} />
        <path
          className="instrument__arrowhead"
          d={`M ${WIND.cx} ${WIND.cy - WIND.radius + 5} l -4.5 8 l 9 0 z`}
        />
        <path
          className="instrument__fletch"
          d={`M ${WIND.cx - 4} ${WIND.cy + WIND.radius - 5} L ${WIND.cx} ${WIND.cy + WIND.radius - 10} L ${WIND.cx + 4} ${WIND.cy + WIND.radius - 5}`}
        />
      </g>
      {BARS.map((bar, index) => (
        <rect
          key={bar.x}
          className="instrument__bar"
          ref={(element) => {
            barRefs.current[index] = element;
          }}
          x={bar.x}
          y={BAR_BASE - bar.height}
          width={14}
          height={bar.height}
          rx={1}
        />
      ))}
    </svg>
  );
}
