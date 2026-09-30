import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { BRUSH_REACH, Complexion, FIELD, fieldOutline } from "./cosmetics";
import { easeInOut, prepareCanvas } from "./instrumentFace";
import { offscreen, seeded } from "./material";

// Drawing space: the gesture plate's 200 × 140, the field in the middle.
const WIDTH = 200;
const HEIGHT = 140;
/** Offscreen pixels per unit of drawing space. */
const RES = 3;
/** How long the rest of the field takes to warm in once enough is done. */
const WARM_MS = 1100;
/** Under reduced motion the warmth arrives as a plain, shorter fade. */
const STILL_WARM_MS = 600;
/** Distance between dabs along a brush stroke, in drawing units. */
const DAB_STEP = 2.2;
/** How strongly the warm layer covers the pale body when fully laid. */
const WARM = 0.6;
/** What a brushed patch still shows over the finished warmth: a trace of the strokes. */
const TRACE = 0.1;

const BODY_LIGHT = "#d5d7d4";
const BODY = "#c7cac8";
const BODY_SHADE = "#aeb2b3";
const RIM = "rgba(58, 64, 72, 0.3)";
const CRAZE = "rgba(74, 82, 92, 0.14)";
const CRAZE_LIGHT = "rgba(255, 255, 255, 0.12)";
const PEACH = [232, 170, 140] as const;
const ROSE = [220, 146, 138] as const;
const WARM_FILL = "rgb(229, 166, 144)";
const SHADOW = "rgba(0, 0, 0, 0.34)";

/** What the gesture plate asks of the field as the reader brushes. */
export interface CosmeticsHandle {
  /** Draw the brush between two points on screen; returns progress, 0 to 1. */
  brush: (fromX: number, fromY: number, toX: number, toY: number) => number;
}

interface ApplyCosmeticsProps {
  finished: boolean;
  /** Finished by a page turn: show the warm field at once, with no warm-in. */
  instant: boolean;
  reducedMotion: boolean;
  ref?: Ref<CosmeticsHandle>;
}

interface Layers {
  /** The pale body: its colour, shading, grain, and the shadow it casts. */
  body: HTMLCanvasElement;
  /** The warmth the brush has laid, dab by dab. */
  tint: HTMLCanvasElement;
  tintContext: CanvasRenderingContext2D;
  /** The whole field warm, slightly mottled, for the warm-in. */
  warm: HTMLCanvasElement;
  /** The glaze over everything: crazing, one soft highlight, the rim. */
  glaze: HTMLCanvasElement;
  /** Soft round dabs of foundation, peach and rose. */
  dabs: [HTMLCanvasElement, HTMLCanvasElement];
}

/** Whether a point is close enough to the field for the brush to lay colour on it. */
function nearField(x: number, y: number): boolean {
  return ((x - FIELD.cx) / (FIELD.rx + BRUSH_REACH * 2)) ** 2 + ((y - FIELD.cy) / (FIELD.ry + BRUSH_REACH * 2)) ** 2 <= 1;
}

/** Trace the field's outline as the current path. */
function trace(context: CanvasRenderingContext2D, outline: Float32Array) {
  context.beginPath();
  for (let index = 0; index < outline.length; index += 2) {
    if (index === 0) context.moveTo(outline[index], outline[index + 1]);
    else context.lineTo(outline[index], outline[index + 1]);
  }
  context.closePath();
}

function paintBody(context: CanvasRenderingContext2D, outline: Float32Array) {
  // A soft shadow beneath, as if the tile rests a little above the plate.
  context.save();
  context.shadowColor = SHADOW;
  context.shadowBlur = 10 * RES;
  context.shadowOffsetY = 3 * RES;
  context.fillStyle = BODY;
  trace(context, outline);
  context.fill();
  context.restore();
  // Lit from the upper left, falling away to a cooler grey at the far edge.
  const light = context.createRadialGradient(FIELD.cx - 26, FIELD.cy - 20, 4, FIELD.cx, FIELD.cy, FIELD.rx * 1.15);
  light.addColorStop(0, BODY_LIGHT);
  light.addColorStop(0.55, BODY);
  light.addColorStop(1, BODY_SHADE);
  context.fillStyle = light;
  trace(context, outline);
  context.fill();
  // The fine speckle of an unglazed body, felt more than seen.
  context.save();
  trace(context, outline);
  context.clip();
  const random = seeded(1307);
  for (let speck = 0; speck < 520; speck += 1) {
    const x = FIELD.cx + (random() - 0.5) * FIELD.rx * 2.2;
    const y = FIELD.cy + (random() - 0.5) * FIELD.ry * 2.2;
    context.fillStyle = random() < 0.5 ? "rgba(60, 64, 70, 0.06)" : "rgba(255, 255, 255, 0.08)";
    context.fillRect(x, y, 0.5 + random() * 0.6, 0.5 + random() * 0.6);
  }
  context.restore();
}

function paintGlaze(context: CanvasRenderingContext2D, outline: Float32Array) {
  context.save();
  trace(context, outline);
  context.clip();
  // Crazing: a net of fine cracks through the glaze, from a jittered grid.
  const random = seeded(2291);
  const spacing = 10;
  const cols = Math.ceil((FIELD.rx * 2.3) / spacing) + 1;
  const rows = Math.ceil((FIELD.ry * 2.3) / spacing) + 1;
  const left = FIELD.cx - FIELD.rx * 1.15;
  const top = FIELD.cy - FIELD.ry * 1.15;
  const nodes = new Float32Array(cols * rows * 2);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const at = (row * cols + col) * 2;
      nodes[at] = left + col * spacing + (random() - 0.5) * spacing * 0.8;
      nodes[at + 1] = top + row * spacing + (random() - 0.5) * spacing * 0.8;
    }
  }
  const crack = (from: number, to: number, bend: number) => {
    const mx = (nodes[from] + nodes[to]) / 2 + bend;
    const my = (nodes[from + 1] + nodes[to + 1]) / 2 - bend * 0.6;
    context.moveTo(nodes[from], nodes[from + 1]);
    context.quadraticCurveTo(mx, my, nodes[to], nodes[to + 1]);
  };
  const net = () => {
    const local = seeded(4721);
    context.beginPath();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const at = (row * cols + col) * 2;
        if (col + 1 < cols && local() < 0.64) crack(at, at + 2, (local() - 0.5) * 2.4);
        if (row + 1 < rows && local() < 0.64) crack(at, at + cols * 2, (local() - 0.5) * 2.4);
      }
    }
    context.stroke();
  };
  context.lineWidth = 0.32;
  context.strokeStyle = CRAZE_LIGHT;
  context.translate(0.35, 0.35);
  net();
  context.translate(-0.35, -0.35);
  context.strokeStyle = CRAZE;
  net();
  // One soft highlight where the glaze catches the light.
  const sheen = context.createRadialGradient(FIELD.cx - 30, FIELD.cy - 22, 1, FIELD.cx - 30, FIELD.cy - 22, 30);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.22)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = sheen;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.restore();
  context.strokeStyle = RIM;
  context.lineWidth = 0.7;
  trace(context, outline);
  context.stroke();
}

function paintWarm(context: CanvasRenderingContext2D, outline: Float32Array) {
  context.save();
  trace(context, outline);
  context.clip();
  context.fillStyle = WARM_FILL;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  // A few broad, soft patches of rose and peach, so the finish is not flat.
  const random = seeded(887);
  for (let patch = 0; patch < 9; patch += 1) {
    const x = FIELD.cx + (random() - 0.5) * FIELD.rx * 1.6;
    const y = FIELD.cy + (random() - 0.5) * FIELD.ry * 1.6;
    const radius = 14 + random() * 18;
    const [r, g, b] = patch % 2 === 0 ? ROSE : PEACH;
    const blush = context.createRadialGradient(x, y, 0, x, y, radius);
    blush.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.55)`);
    blush.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    context.fillStyle = blush;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  context.restore();
}

function paintDab(context: CanvasRenderingContext2D, colour: readonly [number, number, number], radius: number) {
  const [r, g, b] = colour;
  const dab = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
  dab.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
  dab.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.5)`);
  dab.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  context.fillStyle = dab;
  context.fillRect(0, 0, radius * 2, radius * 2);
}

/**
 * A pale, cool, featureless glazed field that the reader makes up with the
 * pointer (ADR-0013). Where the brush passes a warm, soft-edged tint blooms
 * and stays; once most of the field is warm, the rest warms in by itself.
 */
export function ApplyCosmetics({ finished, instant, reducedMotion, ref }: ApplyCosmeticsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // One field per mount: the gesture plate remounts this for each new beat.
  const [complexion] = useState(() => new Complexion());
  const [outline] = useState(() => fieldOutline());
  const layers = useRef<Layers | null>(null);
  const loop = useRef({ frame: 0, running: false, warmStart: -1, dabs: 0 });
  const redraw = useRef<(now: number) => void>(() => {});

  useEffect(() => {
    const body = offscreen(WIDTH, HEIGHT, RES);
    const tint = offscreen(WIDTH, HEIGHT, RES);
    const warm = offscreen(WIDTH, HEIGHT, RES);
    const glaze = offscreen(WIDTH, HEIGHT, RES);
    const reach = BRUSH_REACH * 1.25;
    const peach = offscreen(reach * 2, reach * 2, RES);
    const rose = offscreen(reach * 2, reach * 2, RES);
    if (body && tint && warm && glaze && peach && rose) {
      paintBody(body.context, outline);
      paintWarm(warm.context, outline);
      paintGlaze(glaze.context, outline);
      paintDab(peach.context, PEACH, reach);
      paintDab(rose.context, ROSE, reach);
      layers.current = {
        body: body.canvas,
        tint: tint.canvas,
        tintContext: tint.context,
        warm: warm.canvas,
        glaze: glaze.canvas,
        dabs: [peach.canvas, rose.canvas],
      };
    }
    redraw.current(performance.now());
    const state = loop.current;
    return () => {
      window.cancelAnimationFrame(state.frame);
      state.running = false;
    };
  }, [outline]);

  useEffect(() => {
    const state = loop.current;
    const length = reducedMotion ? STILL_WARM_MS : WARM_MS;

    const draw = (now: number) => {
      const context = prepareCanvas(canvasRef.current, WIDTH);
      const layer = layers.current;
      if (!context || !layer) return;
      const warmth = !finished ? 0 : state.warmStart < 0 ? 1 : easeInOut((now - state.warmStart) / length);
      context.drawImage(layer.body, 0, 0, WIDTH, HEIGHT);
      if (warmth > 0) {
        context.globalAlpha = WARM * warmth;
        context.drawImage(layer.warm, 0, 0, WIDTH, HEIGHT);
      }
      // The brushed warmth, clipped to the field, receding to a trace as the rest warms in.
      context.save();
      trace(context, outline);
      context.clip();
      context.globalAlpha = WARM * (1 - warmth) + TRACE * warmth;
      context.drawImage(layer.tint, 0, 0, WIDTH, HEIGHT);
      context.restore();
      context.globalAlpha = 1;
      context.drawImage(layer.glaze, 0, 0, WIDTH, HEIGHT);
    };

    const tick = (now: number) => {
      draw(now);
      if (finished && state.warmStart >= 0 && now - state.warmStart < length) {
        state.frame = window.requestAnimationFrame(tick);
      } else {
        state.running = false;
      }
    };

    redraw.current = (now: number) => {
      if (state.running) return;
      state.running = true;
      tick(now);
    };

    if (finished && state.warmStart === -1) {
      // A page turn shows the field warm at once; otherwise it warms in.
      state.warmStart = instant ? -2 : performance.now();
    }
    redraw.current(performance.now());
    return () => {
      window.cancelAnimationFrame(state.frame);
      state.running = false;
    };
  }, [finished, instant, outline, reducedMotion]);

  /** A screen point in drawing units, or null off the canvas. */
  const locate = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * ((WIDTH * rect.height) / rect.width),
    };
  };

  useImperativeHandle(ref, () => ({
    brush(fromX, fromY, toX, toY) {
      const from = locate(fromX, fromY);
      const to = locate(toX, toY);
      if (!from || !to) return complexion.progress();
      complexion.brush(from.x, from.y, to.x, to.y);
      const layer = layers.current;
      if (layer && (nearField(from.x, from.y) || nearField(to.x, to.y))) {
        // Soft dabs along the stroke, alternating peach and rose, a little uneven.
        const reach = BRUSH_REACH * 1.25;
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const steps = Math.max(1, Math.ceil(distance / DAB_STEP));
        const normalX = distance > 0 ? -(to.y - from.y) / distance : 0;
        const normalY = distance > 0 ? (to.x - from.x) / distance : 0;
        const context = layer.tintContext;
        for (let step = 1; step <= steps; step += 1) {
          const t = step / steps;
          const count = loop.current.dabs;
          loop.current.dabs += 1;
          // Uneven: each dab a little stronger or weaker, and a little off the line.
          const jitter = (((count * 5) % 7) - 3) * 0.6;
          context.globalAlpha = 0.12 + ((count * 7) % 5) * 0.05;
          context.drawImage(
            layer.dabs[count % 3 === 0 ? 1 : 0],
            from.x + (to.x - from.x) * t - reach + normalX * jitter,
            from.y + (to.y - from.y) * t - reach + normalY * jitter,
            reach * 2,
            reach * 2,
          );
        }
        context.globalAlpha = 1;
      }
      redraw.current(performance.now());
      return complexion.progress();
    },
  }));

  return <canvas className="gesture__art gesture__cosmetics" ref={canvasRef} aria-hidden="true" />;
}
