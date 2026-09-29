import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { reactiveLevel, reactiveWaveform } from "./reactiveBus";
import type { InstrumentReading } from "./staging";
import type { InstrumentKey, Layout } from "./types";

interface InstrumentProps {
  reading: InstrumentReading | null;
  /** The last move was a page turn; a jump lands on the new reading at once. */
  stepped: boolean;
  layout: Layout;
  reducedMotion: boolean;
  /** Sound is audible, so the meter may react to it. */
  reactive: boolean;
  /** Event art is on screen; the instrument steps back. */
  dimmed: boolean;
  hidden: boolean;
  viewportRef: React.RefObject<HTMLElement | null>;
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

  const needleRef = useRef<SVGGElement | null>(null);
  const digitsRef = useRef<HTMLSpanElement | null>(null);
  const traceRef = useRef<HTMLCanvasElement | null>(null);
  const motion = useRef({ needle: 0, velocity: 0, roll: null as null | { from: number; to: number; places: number; start: number } });
  const lastKey = useRef<InstrumentKey | null>(null);

  const key = shown?.key ?? null;
  const placement =
    shown?.cue.placement === "auto" || !shown
      ? placedLayout === "adv"
        ? "above_text"
        : "top_right"
      : shown.cue.placement;

  // A new key: roll the digits on a tuning page turn, snap everything on a jump.
  // The digits are written here and by the frame loop only, never by React, so
  // a roll in progress is never overwritten by a re-render.
  useLayoutEffect(() => {
    if (!key || key === lastKey.current) return;
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
    if (!key || !visible) return;
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

  if (!shown || !key) return null;

  return (
    <div
      className={`instrument instrument--${shown.cue.kind} instrument--${placement}${visible ? " is-visible" : ""}${dimmed ? " is-dimmed" : ""}${key.state === "off" ? " is-off" : ""}${placement === "above_text" && !placed ? " is-unplaced" : ""}`}
      style={placed ? { right: placed.right, bottom: placed.bottom } : undefined}
      aria-hidden="true"
    >
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
    </div>
  );
}
