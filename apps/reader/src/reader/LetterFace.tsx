import { useEffect, useLayoutEffect, useRef } from "react";
import { easeInOut, easeOut, prepareCanvas, type FaceProps } from "./instrumentFace";
import { LETTER_SHEETS, sheetsTurned } from "./letter";
import { offscreen, paintPaper } from "./material";
import type { LetterKey, LetterState } from "./types";

// Drawing space: two piles of portrait sheets side by side.
const WIDTH = 220;
const SHEET = { w: 50, h: 66 };
const LEFT = { x: 66, y: 47 };
const RIGHT = { x: 154, y: 47 };
const CENTRE = { x: 110, y: 48 };
/** Each sheet's resting angle and nudge, so the piles fan a little. */
const FAN = [-0.05, 0.035, -0.02, 0.045, -0.035, 0.015, -0.012, 0.04, -0.045, 0.022];
const NUDGE = [0.6, -0.8, 0.3, -0.4, 0.9, -0.2, 0.5, -0.7, 0.2, -0.5];
/**
 * Rows of abstract handwriting on the sheet being read: each row is a run of
 * word-length strokes, never glyphs. The first row is indented; the last
 * breaks off short.
 */
const ROWS: readonly (readonly number[])[] = [
  [5, 4, 7, 3, 6],
  [6, 3, 7, 5, 4, 3],
  [4, 7, 5, 6, 4, 2],
  [7, 3, 5, 3, 6, 4],
  [5, 6, 4, 8, 6],
  [7, 4, 3, 6, 4, 4],
  [6, 4, 7],
];
const INDENT = 9;
const MARGIN = 5;
const WORD_GAP = 2;
const ROW_TOP = 10;
const ROW_GAP = 7.2;
const LAYER = 0.9;

const PAPER = "#ece3cf";
const PAPER_BACK = "#ddd2ba";
const ENVELOPE = "#e5dac3";
/** The stack once set down: the same paper, dimmer, still cream rather than grey. */
const PAPER_DIM = "#f2d9a8";
const EDGE = "rgba(92, 74, 48, 0.45)";
const INK = "#262c46";
const SHADOW = "rgba(0, 0, 0, 0.3)";

/** Offscreen pixels per drawing unit for the paper textures. */
const RES = 4;
const ENVELOPE_SIZE = { w: 104, h: 60 };

interface Papers {
  face: HTMLCanvasElement;
  back: HTMLCanvasElement;
  dim: HTMLCanvasElement;
  envelope: HTMLCanvasElement;
  inside: HTMLCanvasElement;
}
let papers: Papers | null = null;

/** The sheets' and envelope's paper, grain and edge-light drawn once for every letter. */
function paperTextures(): Papers | null {
  if (papers) return papers;
  const face = offscreen(SHEET.w, SHEET.h, RES);
  const back = offscreen(SHEET.w, SHEET.h, RES);
  const dim = offscreen(SHEET.w, SHEET.h, RES);
  const envelope = offscreen(ENVELOPE_SIZE.w, ENVELOPE_SIZE.h, RES);
  const inside = offscreen(ENVELOPE_SIZE.w, ENVELOPE_SIZE.h, RES);
  if (!face || !back || !dim || !envelope || !inside) return null;
  paintPaper(face.context, SHEET.w, SHEET.h, PAPER, 11);
  paintPaper(back.context, SHEET.w, SHEET.h, PAPER_BACK, 12, 0.8);
  paintPaper(dim.context, SHEET.w, SHEET.h, PAPER_DIM, 13, 0.5);
  paintPaper(envelope.context, ENVELOPE_SIZE.w, ENVELOPE_SIZE.h, ENVELOPE, 14);
  paintPaper(inside.context, ENVELOPE_SIZE.w, ENVELOPE_SIZE.h, PAPER_BACK, 15, 0.4);
  papers = { face: face.canvas, back: back.canvas, dim: dim.canvas, envelope: envelope.canvas, inside: inside.canvas };
  return papers;
}

const FLIP_MS = 620;
const FADE_MS = 520;
const BLOT_MS = 2400;
const BLOT_RADIUS = 4.6;

interface LetterMotion {
  /** Sheets shown on the left pile, excluding one in flight. */
  shown: number;
  target: number;
  /** When the current sheet left its pile, or -1 while none is moving. */
  flightStart: number;
  flightDirection: 1 | -1;
  /** A state being crossfaded out, and when the crossfade began. */
  fadeFrom: LetterState | null;
  fadeStart: number;
  /** When faltering began; the blot spreads from here. */
  falterStart: number;
  state: LetterState | null;
  /** The turned count last written to the canvas's data attribute. */
  written: number;
}

function sheet(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  face: boolean,
  squeeze: number,
  tremble: number,
  blot: number,
  now: number,
  dim = false,
) {
  const alpha = context.globalAlpha;
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(Math.max(0.04, squeeze), 1);
  const textures = paperTextures();
  if (textures) {
    context.drawImage(dim ? textures.dim : face ? textures.face : textures.back, -SHEET.w / 2, -SHEET.h / 2, SHEET.w, SHEET.h);
  } else {
    context.fillStyle = dim ? PAPER_DIM : face ? PAPER : PAPER_BACK;
    context.fillRect(-SHEET.w / 2, -SHEET.h / 2, SHEET.w, SHEET.h);
  }
  context.strokeStyle = EDGE;
  context.lineWidth = 0.5;
  context.strokeRect(-SHEET.w / 2, -SHEET.h / 2, SHEET.w, SHEET.h);
  if (face) {
    context.strokeStyle = INK;
    context.globalAlpha = alpha * 0.72;
    context.lineCap = "round";
    let endX = 0;
    let endY = 0;
    for (let row = 0; row < ROWS.length; row += 1) {
      const words = ROWS[row];
      const shake = tremble * Math.sin(now / 41 + row * 1.9);
      const rowY = -SHEET.h / 2 + ROW_TOP + row * ROW_GAP + shake;
      let x = -SHEET.w / 2 + (row === 0 ? INDENT : MARGIN);
      for (let word = 0; word < words.length; word += 1) {
        const length = words[word];
        // A word dips and rises a little along the line; faltering ink wavers more.
        const lean = ((row * 7 + word * 3) % 5) * 0.12 - 0.24;
        const wobble = 0.5 + tremble * 1.4 * Math.sin(now / 29 + word * 2.3 + row);
        // The pen presses a little harder on some words than others.
        context.lineWidth = 0.6 + ((row * 5 + word * 3) % 4) * 0.1;
        context.beginPath();
        context.moveTo(x, rowY + lean);
        context.quadraticCurveTo(x + length / 2, rowY + lean - wobble, x + length, rowY - lean);
        context.stroke();
        x += length + WORD_GAP;
      }
      endX = x;
      endY = rowY;
    }
    if (blot > 0) {
      // One blot where the last line breaks off, with two smaller splashes.
      const radius = BLOT_RADIUS * blot;
      const blotX = endX + 1.5;
      const blotY = endY + 1;
      context.globalAlpha = alpha * 0.85;
      context.fillStyle = INK;
      context.beginPath();
      context.arc(blotX, blotY, radius, 0, Math.PI * 2);
      context.moveTo(blotX + radius * 1.33, blotY - radius * 0.55);
      context.arc(blotX + radius * 0.95, blotY - radius * 0.55, radius * 0.38, 0, Math.PI * 2);
      context.moveTo(blotX - radius * 0.32, blotY + radius * 0.85);
      context.arc(blotX - radius * 0.6, blotY + radius * 0.85, radius * 0.28, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function pile(
  context: CanvasRenderingContext2D,
  centre: { x: number; y: number },
  first: number,
  count: number,
  face: boolean,
  tremble: number,
  blot: number,
  now: number,
) {
  if (count <= 0) return;
  context.fillStyle = SHADOW;
  context.fillRect(centre.x - SHEET.w / 2 + 2, centre.y - SHEET.h / 2 + 3, SHEET.w, SHEET.h);
  for (let layer = 0; layer < count; layer += 1) {
    const index = (first + layer) % LETTER_SHEETS;
    const top = layer === count - 1;
    sheet(
      context,
      centre.x + NUDGE[index],
      centre.y - layer * LAYER,
      FAN[index],
      face && top,
      1,
      top ? tremble : 0,
      top ? blot : 0,
      now,
    );
  }
}

function envelope(context: CanvasRenderingContext2D) {
  const { w, h } = ENVELOPE_SIZE;
  context.save();
  context.translate(CENTRE.x, CENTRE.y);
  context.rotate(-0.03);
  context.fillStyle = SHADOW;
  context.fillRect(-w / 2 + 2, -h / 2 + 4, w, h);
  // The thickness of the sheets inside, as edges under the front.
  const textures = paperTextures();
  for (let layer = 3; layer > 0; layer -= 1) {
    if (textures) context.drawImage(textures.inside, -w / 2, -h / 2 + layer * 1.1, w, h);
    else {
      context.fillStyle = PAPER_BACK;
      context.fillRect(-w / 2, -h / 2 + layer * 1.1, w, h);
    }
    context.strokeStyle = EDGE;
    context.lineWidth = 0.4;
    context.strokeRect(-w / 2, -h / 2 + layer * 1.1, w, h);
  }
  if (textures) context.drawImage(textures.envelope, -w / 2, -h / 2, w, h);
  else {
    context.fillStyle = ENVELOPE;
    context.fillRect(-w / 2, -h / 2, w, h);
  }
  context.strokeStyle = EDGE;
  context.lineWidth = 0.6;
  context.strokeRect(-w / 2, -h / 2, w, h);
  context.beginPath();
  context.moveTo(-w / 2, -h / 2);
  context.lineTo(0, 5);
  context.lineTo(w / 2, -h / 2);
  context.stroke();
  context.globalAlpha *= 0.5;
  context.beginPath();
  context.moveTo(-w / 2, h / 2);
  context.lineTo(-9, 2);
  context.moveTo(w / 2, h / 2);
  context.lineTo(9, 2);
  context.stroke();
  context.restore();
}

function squared(context: CanvasRenderingContext2D) {
  context.save();
  context.translate(CENTRE.x, CENTRE.y + 2);
  context.rotate(-0.07);
  context.fillStyle = SHADOW;
  context.fillRect(-SHEET.w / 2 + 2, -SHEET.h / 2 + 3, SHEET.w, SHEET.h);
  for (let layer = 0; layer < LETTER_SHEETS; layer += 1) {
    sheet(context, 0, -layer * 0.5, 0, false, 1, 0, 0, 0, true);
  }
  context.restore();
}

/**
 * The letter in hand (ADR-0009): a stack of cream sheets split into what has
 * been read, turned face down on the left, and what is still to read on the
 * right, the top sheet showing abstract lines. How far through the letter the
 * reader is comes from reading position, never from a count.
 */
export function LetterFace({
  letterKey: key,
  turned,
  stepped,
  reducedMotion,
  visible,
}: FaceProps & { letterKey: LetterKey; turned: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const motion = useRef<LetterMotion>({
    shown: 0,
    target: 0,
    flightStart: -1,
    flightDirection: 1,
    fadeFrom: null,
    fadeStart: 0,
    falterStart: -Infinity,
    state: null,
    written: -1,
  });

  // A new reading: page turns move sheets and crossfade states; jumps land.
  useLayoutEffect(() => {
    const state = motion.current;
    const now = performance.now();
    const moving = stepped && !reducedMotion && state.state !== null;
    state.target = sheetsTurned(turned);
    if (!moving) {
      state.shown = state.target;
      state.flightStart = -1;
    }
    if (key.state !== state.state) {
      state.fadeFrom = moving ? state.state : null;
      state.fadeStart = now;
      if (key.state === "faltering") state.falterStart = moving ? now : -Infinity;
      state.state = key.state;
    }
  }, [key, reducedMotion, stepped, turned]);

  useEffect(() => {
    const state = motion.current;

    const scene = (context: CanvasRenderingContext2D, mode: LetterState, now: number, still: boolean) => {
      if (mode === "sealed") {
        envelope(context);
        return;
      }
      if (mode === "set_down") {
        squared(context);
        return;
      }
      const faltering = mode === "faltering";
      const tremble = faltering && !still ? 0.45 : 0;
      const blot = faltering ? (still ? 1 : easeOut((now - state.falterStart) / BLOT_MS)) : 0;
      const flying = state.flightStart >= 0;
      const t = flying ? easeInOut((now - state.flightStart) / FLIP_MS) : 0;
      const forward = state.flightDirection === 1;
      const left = flying && !forward ? state.shown - 1 : state.shown;
      const right = LETTER_SHEETS - state.shown - (flying && forward ? 1 : 0);
      pile(context, LEFT, 0, left, false, 0, 0, now);
      pile(context, RIGHT, LETTER_SHEETS - right, right, true, tremble, blot, now);
      if (flying) {
        // The sheet lifts, turns over as it crosses, and settles on the other pile.
        const from = forward ? RIGHT : LEFT;
        const to = forward ? LEFT : RIGHT;
        const index = forward ? state.shown : state.shown - 1;
        const arc = Math.sin(Math.PI * t);
        const faceUp = forward ? t < 0.5 : t >= 0.5;
        sheet(
          context,
          from.x + (to.x - from.x) * t,
          from.y + (to.y - from.y) * t - arc * 9,
          FAN[index % LETTER_SHEETS] * (1 - arc) - arc * 0.12 * state.flightDirection,
          faceUp,
          Math.abs(Math.cos(Math.PI * t)),
          0,
          0,
          now,
        );
      }
    };

    const draw = (now: number, still: boolean) => {
      const canvas = canvasRef.current;
      if (canvas && state.written !== state.shown) {
        canvas.dataset.turned = String(state.shown);
        state.written = state.shown;
      }
      const context = prepareCanvas(canvas, WIDTH);
      if (!context || !state.state) return;
      const fade = state.fadeFrom && !still ? (now - state.fadeStart) / FADE_MS : 1;
      if (fade < 1 && state.fadeFrom) {
        context.globalAlpha = 1 - easeOut(fade);
        scene(context, state.fadeFrom, now, still);
      } else {
        state.fadeFrom = null;
      }
      context.globalAlpha = fade < 1 ? easeOut(fade) : 1;
      scene(context, state.state, now, still);
      context.globalAlpha = 1;
    };

    if (!visible || reducedMotion) {
      state.shown = state.target;
      state.flightStart = -1;
      state.fadeFrom = null;
      draw(performance.now(), true);
      return;
    }

    let frame = 0;
    const tick = (now: number) => {
      if (state.flightStart >= 0 && now - state.flightStart >= FLIP_MS) {
        state.shown += state.flightDirection;
        state.flightStart = -1;
      }
      if (state.flightStart < 0 && state.shown !== state.target) {
        state.flightDirection = state.target > state.shown ? 1 : -1;
        state.flightStart = now;
      }
      draw(now, false);
      // Keep drawing only while something moves: a sheet, a crossfade, or faltering ink.
      const busy = state.flightStart >= 0 || state.fadeFrom !== null || state.state === "faltering";
      if (busy) frame = window.requestAnimationFrame(tick);
    };
    // The first frame is drawn at once, so a jump never shows the old piles.
    tick(performance.now());
    return () => window.cancelAnimationFrame(frame);
  }, [key, reducedMotion, turned, visible]);

  return <canvas className="instrument__letter" ref={canvasRef} />;
}
