import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { CARVE_COLS, CARVE_ROWS, Carving, figureOutline, KNIFE_REACH, type CarveStage } from "./carve";
import { easeOut, prepareCanvas } from "./instrumentFace";

// Drawing space: the gesture plate's 200 × 140, a block standing in the middle.
const WIDTH = 200;
const BLOCK = { x: 66, y: 10, w: 68, h: 117 };
const CELL = BLOCK.w / CARVE_COLS;
/** Offscreen pixels per unit of drawing space. */
const RES = 4;
const FADE_MS = 700;
const SHAVINGS = 24;
const SHAVING_LIFE = 0.9;
/** Cells pared between one shaving and the next. */
const SHAVING_EVERY = 5;
const GRAVITY = 150;

const WOOD = "#d6c097";
const WOOD_SHADE = "rgba(92, 64, 32, 0.16)";
const GRAIN = "rgba(112, 80, 44, 0.2)";
const SHAVING = "#ecdcb6";
const SHAVING_EDGE = "rgba(92, 64, 32, 0.55)";
const OUTLINE = "rgba(92, 64, 36, 0.45)";
const SHADOW = "rgba(0, 0, 0, 0.32)";

/** What the gesture plate asks of the carving as the reader drags. */
export interface CarveHandle {
  /** Draw the knife between two points on screen; returns progress, 0 to 1. */
  pare: (fromX: number, fromY: number, toX: number, toY: number) => number;
  /** Lift the knife at the end of a drag; returns progress, 0 to 1. */
  lift: () => number;
}

interface CarveWoodProps {
  stage: CarveStage;
  finished: boolean;
  reducedMotion: boolean;
  ref?: Ref<CarveHandle>;
}

/** Trace the figure's outline, given in shares of the block, as the current path. */
function trace(context: CanvasRenderingContext2D, figure: Float32Array) {
  context.beginPath();
  for (let index = 0; index < figure.length; index += 2) {
    const x = BLOCK.x + figure[index] * BLOCK.w;
    const y = BLOCK.y + figure[index + 1] * BLOCK.h;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function paintWood(context: CanvasRenderingContext2D) {
  context.fillStyle = WOOD;
  context.fillRect(0, 0, BLOCK.w, BLOCK.h);
  // A little shade down the right face, and faint grain running the length.
  context.fillStyle = WOOD_SHADE;
  context.fillRect(BLOCK.w * 0.72, 0, BLOCK.w * 0.28, BLOCK.h);
  context.strokeStyle = GRAIN;
  context.lineWidth = 0.5;
  for (let line = 0; line < 6; line += 1) {
    const x = 5 + line * 9.3;
    context.beginPath();
    context.moveTo(x, 0);
    context.bezierCurveTo(x + 2.5, BLOCK.h * 0.3, x - 2, BLOCK.h * 0.65, x + 1, BLOCK.h);
    context.stroke();
  }
}

/**
 * A small block of pale wood pared away stroke by stroke toward a hidden
 * standing figure (ADR-0012). The figure is cut from the same wood, so it
 * shows only where the waste has come away; curling shavings fly off each
 * cut. When the carving is finished, the rest of the waste fades away.
 */
export function CarveWood({ stage, finished, reducedMotion, ref }: CarveWoodProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // One carving per mount: the gesture plate remounts this for each new beat.
  const [carving] = useState(() => new Carving(stage));
  const [figure] = useState(() => figureOutline(stage));
  const layers = useRef<{ pristine: HTMLCanvasElement; material: HTMLCanvasElement } | null>(null);
  // Shavings: x, y, vx, vy, age, spin, size for each, in a fixed pool.
  const shavings = useRef(new Float32Array(SHAVINGS * 7));
  const loop = useRef({ frame: 0, running: false, fadeStart: -1, next: 0, last: 0, since: 0 });
  const redraw = useRef<(now: number) => void>(() => {});

  useEffect(() => {
    const pristine = document.createElement("canvas");
    const material = document.createElement("canvas");
    pristine.width = material.width = BLOCK.w * RES;
    pristine.height = material.height = BLOCK.h * RES;
    const wood = pristine.getContext("2d");
    const cut = material.getContext("2d");
    if (wood && cut) {
      wood.scale(RES, RES);
      paintWood(wood);
      cut.drawImage(pristine, 0, 0);
    }
    layers.current = { pristine, material };
    redraw.current(performance.now());
    const state = loop.current;
    return () => {
      window.cancelAnimationFrame(state.frame);
      state.running = false;
    };
  }, []);

  useEffect(() => {
    const state = loop.current;
    const pool = shavings.current;

    const draw = (now: number) => {
      const context = prepareCanvas(canvasRef.current, WIDTH);
      if (!context || !layers.current) return;
      const fade = !finished ? 0 : reducedMotion || state.fadeStart < 0 ? 1 : easeOut((now - state.fadeStart) / FADE_MS);

      context.fillStyle = SHADOW;
      context.beginPath();
      context.ellipse(BLOCK.x + BLOCK.w / 2, BLOCK.y + BLOCK.h + 1.5, BLOCK.w * 0.42, 2.6, 0, 0, Math.PI * 2);
      context.fill();

      // What is left of the block, fading once the figure is free.
      context.globalAlpha = 1 - fade;
      context.drawImage(layers.current.material, BLOCK.x, BLOCK.y, BLOCK.w, BLOCK.h);
      context.globalAlpha = 1;

      // The figure, always whole: the knife never reaches it.
      context.save();
      trace(context, figure);
      context.clip();
      context.drawImage(layers.current.pristine, BLOCK.x, BLOCK.y, BLOCK.w, BLOCK.h);
      context.restore();
      if (fade > 0) {
        // Once free, the figure's edge and, when finished, two knife lines where the arms hang.
        context.strokeStyle = OUTLINE;
        context.globalAlpha = fade;
        context.lineWidth = 0.6;
        trace(context, figure);
        context.stroke();
        if (stage === "finish") {
          context.beginPath();
          context.moveTo(BLOCK.x + 0.39 * BLOCK.w, BLOCK.y + 0.29 * BLOCK.h);
          context.quadraticCurveTo(BLOCK.x + 0.37 * BLOCK.w, BLOCK.y + 0.42 * BLOCK.h, BLOCK.x + 0.41 * BLOCK.w, BLOCK.y + 0.53 * BLOCK.h);
          context.moveTo(BLOCK.x + 0.61 * BLOCK.w, BLOCK.y + 0.29 * BLOCK.h);
          context.quadraticCurveTo(BLOCK.x + 0.63 * BLOCK.w, BLOCK.y + 0.42 * BLOCK.h, BLOCK.x + 0.59 * BLOCK.w, BLOCK.y + 0.53 * BLOCK.h);
          context.stroke();
        }
        context.globalAlpha = 1;
      }

      // Shavings curl as they fall: a pale curl with a darker edge, to show on wood and on the plate.
      context.lineCap = "round";
      for (let index = 0; index < SHAVINGS; index += 1) {
        const at = index * 7;
        const age = pool[at + 4];
        if (age <= 0 || age >= SHAVING_LIFE) continue;
        context.globalAlpha = 1 - age / SHAVING_LIFE;
        context.beginPath();
        context.arc(pool[at], pool[at + 1], pool[at + 6], pool[at + 5], pool[at + 5] + Math.PI * 1.5);
        context.strokeStyle = SHAVING_EDGE;
        context.lineWidth = 1.4;
        context.stroke();
        context.strokeStyle = SHAVING;
        context.lineWidth = 0.8;
        context.stroke();
      }
      context.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - state.last) / 1000);
      state.last = now;
      let alive = false;
      for (let index = 0; index < SHAVINGS; index += 1) {
        const at = index * 7;
        if (pool[at + 4] <= 0 || pool[at + 4] >= SHAVING_LIFE) continue;
        pool[at + 4] += dt;
        pool[at + 3] += GRAVITY * dt;
        pool[at] += pool[at + 2] * dt;
        pool[at + 1] += pool[at + 3] * dt;
        pool[at + 5] += dt * 7;
        alive = true;
      }
      draw(now);
      const fading = finished && !reducedMotion && state.fadeStart >= 0 && now - state.fadeStart < FADE_MS;
      if (alive || fading) {
        state.frame = window.requestAnimationFrame(tick);
      } else {
        state.running = false;
      }
    };

    redraw.current = (now: number) => {
      if (state.running) return;
      state.last = now;
      if (reducedMotion) {
        draw(now);
        return;
      }
      state.running = true;
      tick(now);
    };

    if (finished && state.fadeStart < 0) state.fadeStart = performance.now();
    redraw.current(performance.now());
    return () => {
      window.cancelAnimationFrame(state.frame);
      state.running = false;
    };
  }, [figure, finished, reducedMotion, stage]);

  /** A screen point as block cells and as drawing units, or null off the canvas. */
  const locate = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    const y = ((clientY - rect.top) / rect.height) * ((WIDTH * rect.height) / rect.width);
    return { x, y, col: (x - BLOCK.x) / CELL, row: (y - BLOCK.y) / (BLOCK.h / CARVE_ROWS) };
  };

  useImperativeHandle(ref, () => ({
    pare(fromX, fromY, toX, toY) {
      const state = carving;
      const from = locate(fromX, fromY);
      const to = locate(toX, toY);
      if (!from || !to) return state.progress();
      const inside = (point: { col: number; row: number }) =>
        point.col > -KNIFE_REACH && point.col < CARVE_COLS + KNIFE_REACH && point.row > -KNIFE_REACH && point.row < CARVE_ROWS + KNIFE_REACH;
      if (!inside(from) && !inside(to)) return state.progress();
      const pared = state.pare(from.col, from.row, to.col, to.row);
      if (pared > 0 && layers.current) {
        const cut = layers.current.material.getContext("2d");
        if (cut) {
          cut.save();
          cut.globalCompositeOperation = "destination-out";
          cut.lineCap = "round";
          cut.lineWidth = KNIFE_REACH * 2 * CELL * RES;
          cut.beginPath();
          cut.moveTo((from.x - BLOCK.x) * RES, (from.y - BLOCK.y) * RES);
          cut.lineTo((to.x - BLOCK.x) * RES, (to.y - BLOCK.y) * RES);
          cut.stroke();
          cut.restore();
        }
        loop.current.since += pared;
        if (!reducedMotion && loop.current.since >= SHAVING_EVERY) {
          // A shaving curls off to one side of the cut, every few cells pared.
          loop.current.since = 0;
          const pool = shavings.current;
          const count = loop.current.next;
          loop.current.next += 1;
          const at = (count % SHAVINGS) * 7;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const length = Math.hypot(dx, dy) || 1;
          const side = count % 2 === 0 ? 1 : -1;
          const spread = 0.6 + ((count * 7) % 5) * 0.2;
          pool[at] = to.x;
          pool[at + 1] = to.y;
          pool[at + 2] = (dx / length) * 24 * spread + (-dy / length) * 26 * side;
          pool[at + 3] = -36 - 22 * spread;
          pool[at + 4] = 0.001;
          pool[at + 5] = Math.atan2(dy, dx) + count;
          pool[at + 6] = 1.6 + ((count * 5) % 4) * 0.5;
        }
      }
      redraw.current(performance.now());
      return state.progress();
    },
    lift() {
      const state = carving;
      state.lift();
      return state.progress();
    },
  }));

  return <canvas className="gesture__art gesture__carving" ref={canvasRef} aria-hidden="true" />;
}
