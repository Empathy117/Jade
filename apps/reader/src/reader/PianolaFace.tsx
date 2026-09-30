import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { easeInOut, prepareCanvas, type FaceProps } from "./instrumentFace";
import { holeAt, PIANOLA_TRACKS, punchRoll, scatterKeys } from "./pianola";
import type { PianolaKey, PianolaState } from "./types";

// Drawing space: a wooden case, a window onto the roll, a bar, a row of keys.
const WIDTH = 220;
const CASE = { x: 8, y: 4, w: 204, h: 88 };
const WINDOW = { x: 40, y: 9, w: 140, h: 44 };
const PAPER = { x: 46, w: 128 };
const TRACK = PAPER.w / PIANOLA_TRACKS;
const BAR_Y = 46;
const PITCH = 3.2;
const HOLE_W = 3.4;
const KEYS = { y: 62, h: 22, gap: 1.2 };
/** Tracks drawn as the dark keys of an octave. */
const EBONY_TRACKS = [false, true, false, true, false, false, true, false, true, false, true, false];
const STILL_ROW = 7.5;
const LID_MS = 900;

const WOOD = "#2b2019";
const WOOD_LID = "#241a14";
const WOOD_EDGE = "rgba(214, 180, 120, 0.22)";
const DARK = "#120e0b";
const ROLL = "#cdb58a";
const HOLE_INK = "#2a2118";
const BRASS = "#b8954c";
const IVORY = "#dcd2bb";
const IVORY_DOWN = "#b9ad95";
const EBONY = "#2c2420";
const EBONY_DOWN = "#4a3e36";

/** Rows per second at a tempo. */
function rowsPerSecond(tempo: number): number {
  return 1.2 + tempo * 3.2;
}

/** A stable pseudo-random choice per track and row, for skipped holes and sticking keys. */
function flaw(track: number, row: number): number {
  const mixed = Math.imul(track * 374761393 + row * 668265263, 1274126177);
  return ((mixed ^ (mixed >>> 13)) >>> 0) % 7;
}

interface PianolaMotion {
  /** Rows of roll that have passed the bar. */
  offset: number;
  speed: number;
  /** How far the lid is open, 0 shut to 1 open, and where it is heading. */
  lid: number;
  lidFrom: number;
  lidTo: number;
  lidStart: number;
  state: PianolaState | null;
  /** How far down each key is, 0 up to 1 down. */
  depth: Float32Array;
}

/**
 * A pianola playing by itself (ADR-0010): a roll of buff paper scrolling down
 * past a brass tracker bar, and a row of keys that dip when a hole passes.
 * The roll is punched from the span's id, so it is the same every time. It
 * makes no sound and listens to none.
 */
export function PianolaFace({
  pianolaKey: key,
  seed,
  stepped,
  reducedMotion,
  visible,
}: FaceProps & { pianolaKey: PianolaKey; seed: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const roll = useMemo(() => punchRoll(seed), [seed]);
  const scattered = useMemo(() => scatterKeys(seed), [seed]);
  const motion = useRef<PianolaMotion>({
    offset: STILL_ROW,
    speed: 0,
    lid: 0,
    lidFrom: 0,
    lidTo: 0,
    lidStart: 0,
    state: null,
    depth: new Float32Array(PIANOLA_TRACKS),
  });

  // A new key: a page turn lifts the lid and eases the roll; a jump lands.
  useLayoutEffect(() => {
    const state = motion.current;
    const moving = stepped && !reducedMotion && state.state !== null;
    const open = key.state === "closed" ? 0 : 1;
    const speed = key.state === "playing" || key.state === "faltering" ? rowsPerSecond(key.tempo ?? 0.5) : 0;
    if (moving) {
      state.lidFrom = state.lid;
      state.lidTo = open;
      state.lidStart = performance.now();
    } else {
      state.lid = open;
      state.lidFrom = open;
      state.lidTo = open;
      state.speed = speed;
    }
    state.state = key.state;
  }, [key, reducedMotion, stepped]);

  useEffect(() => {
    const state = motion.current;
    const target = key.state === "playing" || key.state === "faltering" ? rowsPerSecond(key.tempo ?? 0.5) : 0;
    const faltering = key.state === "faltering";

    const draw = (context: CanvasRenderingContext2D, still: boolean) => {
      context.globalAlpha = 0.7;
      context.fillStyle = WOOD;
      context.fillRect(CASE.x, CASE.y, CASE.w, CASE.h);
      context.globalAlpha = 1;
      context.fillStyle = DARK;
      context.fillRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
      context.fillRect(PAPER.x - 2, KEYS.y - 2, PAPER.w + 4, KEYS.h + 4);

      if (key.state === "dismantled") {
        dismantled(context);
        return;
      }

      // The roll: holes travel down the window toward the bar.
      context.save();
      context.beginPath();
      context.rect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
      context.clip();
      context.fillStyle = ROLL;
      context.fillRect(PAPER.x, WINDOW.y, PAPER.w, WINDOW.h);
      context.fillStyle = HOLE_INK;
      const offset = state.offset;
      // Rows still to come sit above the bar; rows already played, below it.
      const first = Math.floor(offset - (WINDOW.y + WINDOW.h - BAR_Y) / PITCH) - 1;
      const last = Math.ceil(offset + (BAR_Y - WINDOW.y) / PITCH) + 1;
      for (let row = first; row <= last; row += 1) {
        // Consecutive holes on a track join into one slot: a held note.
        const y = BAR_Y + (offset - row) * PITCH - PITCH / 2;
        for (let track = 0; track < PIANOLA_TRACKS; track += 1) {
          if (!holeAt(roll, track, row)) continue;
          const joined = holeAt(roll, track, row + 1);
          context.fillRect(
            PAPER.x + track * TRACK + (TRACK - HOLE_W) / 2,
            y + (joined ? -0.5 : 0.4),
            HOLE_W,
            PITCH - (joined ? -0.5 : 0.8),
          );
        }
      }
      context.restore();

      // The tracker bar and its ports.
      context.fillStyle = BRASS;
      context.fillRect(WINDOW.x, BAR_Y - 1.5, WINDOW.w, 3);
      context.fillStyle = HOLE_INK;
      for (let track = 0; track < PIANOLA_TRACKS; track += 1) {
        context.fillRect(PAPER.x + track * TRACK + TRACK / 2 - 0.7, BAR_Y - 0.7, 1.4, 1.4);
      }

      // Keys: each dips while a hole is over its port.
      const passing = Math.round(offset);
      for (let track = 0; track < PIANOLA_TRACKS; track += 1) {
        let down = holeAt(roll, track, passing) ? 1 : 0;
        if (faltering && down && flaw(track, passing) === 0) down = 0; // a hole that does not sound
        if (still) {
          state.depth[track] = down;
        } else {
          const sticky = faltering && flaw(track, 0) < 2;
          const rate = down > state.depth[track] ? 0.5 : sticky ? 0.03 : 0.22;
          state.depth[track] += (down - state.depth[track]) * rate;
        }
        const depth = state.depth[track];
        const x = PAPER.x + track * TRACK + KEYS.gap / 2;
        const ebony = EBONY_TRACKS[track];
        const height = ebony ? KEYS.h * 0.72 : KEYS.h;
        context.fillStyle = ebony ? (depth > 0.5 ? EBONY_DOWN : EBONY) : depth > 0.5 ? IVORY_DOWN : IVORY;
        context.fillRect(x, KEYS.y + depth * 2, TRACK - KEYS.gap, height - depth * 2);
      }

      // The lid, sliding up out of the way as it opens.
      if (state.lid < 1) {
        const lift = easeInOut(state.lid);
        context.save();
        context.beginPath();
        context.rect(CASE.x, CASE.y, CASE.w, CASE.h);
        context.clip();
        context.globalAlpha = 1 - lift * 0.6;
        const top = CASE.y + 3 - lift * (CASE.h - 6);
        context.fillStyle = WOOD_LID;
        context.fillRect(CASE.x + 3, top, CASE.w - 6, CASE.h - 6);
        context.strokeStyle = WOOD_EDGE;
        context.lineWidth = 0.6;
        context.beginPath();
        context.moveTo(CASE.x + 10, top + 9);
        context.lineTo(CASE.x + CASE.w - 10, top + 9);
        context.moveTo(CASE.x + 10, top + CASE.h - 22);
        context.lineTo(CASE.x + CASE.w - 10, top + CASE.h - 22);
        context.stroke();
        // A small brass knob to lift it by.
        context.fillStyle = BRASS;
        context.beginPath();
        context.arc(CASE.x + CASE.w / 2, top + CASE.h - 15, 1.8, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    };

    const dismantled = (context: CanvasRenderingContext2D) => {
      // The bar stays; the roll hangs out of the window in a slack loop.
      context.fillStyle = BRASS;
      context.fillRect(WINDOW.x, BAR_Y - 1.5, WINDOW.w, 3);
      context.strokeStyle = ROLL;
      context.lineWidth = 9;
      context.lineCap = "butt";
      context.beginPath();
      context.moveTo(84, WINDOW.y + 4);
      context.bezierCurveTo(78, 60, 58, 84, 76, 90);
      context.bezierCurveTo(96, 96, 104, 70, 118, 88);
      context.stroke();
      context.strokeStyle = HOLE_INK;
      context.lineWidth = 1.4;
      context.setLineDash(DASHES);
      context.stroke();
      context.setLineDash(NO_DASH);
      // Keys lie loose and tilted where they fell.
      for (let track = 0; track < PIANOLA_TRACKS; track += 1) {
        context.save();
        context.translate(
          PAPER.x + track * TRACK + TRACK / 2 + scattered[track * 3],
          KEYS.y + KEYS.h / 2 + scattered[track * 3 + 1] * 0.5,
        );
        context.rotate(scattered[track * 3 + 2]);
        context.fillStyle = EBONY_TRACKS[track] ? EBONY_DOWN : IVORY_DOWN;
        context.fillRect(-(TRACK - KEYS.gap) / 2, -KEYS.h / 4, TRACK - KEYS.gap, KEYS.h / 2);
        context.restore();
      }
    };

    const paint = (still: boolean) => {
      const context = prepareCanvas(canvasRef.current, WIDTH);
      if (context) draw(context, still);
    };

    if (!visible || reducedMotion) {
      state.lid = state.lidTo;
      state.speed = target;
      if (reducedMotion) state.offset = STILL_ROW;
      paint(true);
      return;
    }

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (state.lid !== state.lidTo) {
        const t = (now - state.lidStart) / LID_MS;
        state.lid = t >= 1 ? state.lidTo : state.lidFrom + (state.lidTo - state.lidFrom) * t;
      }
      // Speed eases toward the key's tempo, the way a roll motor comes up to speed.
      state.speed += (target - state.speed) * Math.min(1, dt * 2.5);
      let pace = state.speed;
      if (faltering) {
        // The roll lurches and catches: pauses where two slow waves dip together.
        const wave = Math.sin(now / 590) + Math.sin(now / 331);
        pace *= wave < -0.7 ? 0 : 0.45 + 0.45 * (wave + 2) * 0.5;
      }
      state.offset += pace * dt;
      paint(false);
      const moving = state.lid !== state.lidTo || target > 0 || state.speed > 0.01;
      if (moving) frame = window.requestAnimationFrame(tick);
    };
    tick(last);
    return () => window.cancelAnimationFrame(frame);
  }, [key, reducedMotion, roll, scattered, visible]);

  return <canvas className="instrument__pianola" ref={canvasRef} />;
}

const DASHES = [2, 5];
const NO_DASH: number[] = [];
