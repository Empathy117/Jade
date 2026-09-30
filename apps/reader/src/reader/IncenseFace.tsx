import { useEffect, useLayoutEffect, useRef } from "react";
import { prepareCanvas, type FaceProps } from "./instrumentFace";
import { offscreen } from "./material";
import { reactiveLevel } from "./reactiveBus";
import type { IncenseKey, IncenseState } from "./types";

// Drawing space: tall and narrow, a burner at the foot, smoke rising to the top.
const WIDTH = 100;
const BASE = { x: 50, y: 134 };
const STICK = 88;
const HANDLE = 9;
const ASH_MAX = 6;
const SMOKE_TOP = 6;
const SMOKE_POINTS = 28;
const SMOKE_BANDS = 4;
const FALL_MS = 650;
const FADE_OUT_MS = 3200;

const BRONZE = "#3b3025";
const BRONZE_RIM = "rgba(214, 180, 120, 0.4)";
const ASH_BED = "#8c857a";
const STICK_COLOUR = "#8a4a2e";
const HANDLE_COLOUR = "#b0714a";
const ASH = "#a7a198";
const EMBER = "#ff9a4a";
const EMBER_LOW = "#df5a2e";
const SMOKE = "#d7dbe0";

/** The ember's warm light as it falls on the bowl, drawn once and reused. */
let bowlGlow: HTMLCanvasElement | null = null;
const GLOW = { w: 60, h: 20 };
function emberGlow(): HTMLCanvasElement | null {
  if (bowlGlow) return bowlGlow;
  const glow = offscreen(GLOW.w, GLOW.h, 4);
  if (!glow) return null;
  glow.context.scale(1, GLOW.h / GLOW.w);
  const light = glow.context.createRadialGradient(GLOW.w / 2, GLOW.w / 2, 0, GLOW.w / 2, GLOW.w / 2, GLOW.w / 2);
  light.addColorStop(0, "rgba(255, 150, 80, 1)");
  light.addColorStop(0.5, "rgba(255, 130, 70, 0.35)");
  light.addColorStop(1, "rgba(255, 120, 60, 0)");
  glow.context.fillStyle = light;
  glow.context.fillRect(0, 0, GLOW.w, GLOW.w);
  bowlGlow = glow.canvas;
  return bowlGlow;
}

interface IncenseMotion {
  /** Share of the stick burnt as drawn; eases toward `target` on a page turn. */
  burnt: number;
  target: number;
  /** Burnt share when the ash last fell: the ash column is what burnt since. */
  ashFrom: number;
  /** When a piece of ash began to fall, or -1, and how long it was. */
  fallStart: number;
  fallLength: number;
  fallY: number;
  state: IncenseState | null;
  /** When the stick went out: the glow and the last smoke fade from here. */
  outStart: number;
}

/**
 * A stick of incense keeping time (ADR-0011): a thin stick in a bronze bowl,
 * an ember at its tip, ash lengthening and dropping, and one thread of smoke
 * that the scene's sounds make waver like a draught. How much of the stick is
 * gone follows reading position; paging back gives it back.
 */
export function IncenseFace({
  incenseKey: key,
  burnt,
  stepped,
  reducedMotion,
  reactive,
  visible,
}: FaceProps & { incenseKey: IncenseKey; burnt: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const motion = useRef<IncenseMotion>({
    burnt: 0,
    target: 0,
    ashFrom: 0,
    fallStart: -1,
    fallLength: 0,
    fallY: 0,
    state: null,
    outStart: -Infinity,
  });

  // A new reading: a page turn lets the stick ease down; a jump lands.
  useLayoutEffect(() => {
    const state = motion.current;
    const moving = stepped && !reducedMotion && state.state !== null;
    state.target = burnt;
    if (!moving) {
      state.burnt = burnt;
      // Land with the ash that would have built up since the last fall.
      state.ashFrom = burnt - ((burnt * (STICK - HANDLE)) % ASH_MAX) / (STICK - HANDLE);
      state.fallStart = -1;
    }
    if (key.state === "out" && state.state !== "out") {
      state.outStart = moving ? performance.now() : -Infinity;
    }
    state.state = key.state;
  }, [burnt, key, reducedMotion, stepped]);

  useEffect(() => {
    const state = motion.current;

    const draw = (context: CanvasRenderingContext2D, now: number, level: number, still: boolean) => {
      const lit = state.state === "burning" || state.state === "ember";
      const outFor = now - state.outStart;
      const glow = lit ? 1 : state.state === "out" && !still ? Math.max(0, 1 - outFor / 800) : 0;
      // The pale handle never burns; the rest shortens with what is burnt.
      const length = (STICK - HANDLE) * (1 - state.burnt);
      const tipY = BASE.y - HANDLE - length;

      // The stick, with its pale handle standing in the bowl.
      context.lineCap = "round";
      context.lineWidth = 1.6;
      context.strokeStyle = HANDLE_COLOUR;
      context.beginPath();
      context.moveTo(BASE.x, BASE.y + 2);
      context.lineTo(BASE.x, BASE.y - HANDLE);
      context.stroke();
      if (length > 0) {
        context.strokeStyle = STICK_COLOUR;
        context.beginPath();
        context.moveTo(BASE.x, BASE.y - HANDLE);
        context.lineTo(BASE.x, tipY);
        context.stroke();
      }

      // Ash: what has burnt since the last piece fell, bending as it grows.
      const ash =
        state.state === "unlit" || state.state === "out"
          ? 0
          : Math.min(ASH_MAX, (state.burnt - state.ashFrom) * (STICK - HANDLE));
      if (ash > 0.3 && length > 0) {
        context.strokeStyle = ASH;
        context.beginPath();
        context.moveTo(BASE.x, tipY);
        context.quadraticCurveTo(BASE.x, tipY - ash * 0.7, BASE.x + ash * 0.22, tipY - ash);
        context.stroke();
      }
      if (state.fallStart >= 0) {
        const t = Math.min(1, (now - state.fallStart) / FALL_MS);
        const y = state.fallY + (BASE.y - 2 - state.fallY) * t * t;
        context.save();
        context.globalAlpha = 1 - t * 0.5;
        context.translate(BASE.x + t * 3, y);
        context.rotate(t * 1.4);
        context.strokeStyle = ASH;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, -state.fallLength);
        context.stroke();
        context.restore();
      }

      // The ember, breathing slowly; lower and redder in the last stretch.
      if (glow > 0 && length > 0.5) {
        const low = state.state === "ember";
        const breath = still ? 1 : 0.82 + 0.18 * Math.sin(now / 760);
        context.fillStyle = low ? EMBER_LOW : EMBER;
        for (let ring = 3; ring >= 1; ring -= 1) {
          context.globalAlpha = glow * breath * (ring === 1 ? 0.95 : ring === 2 ? 0.22 : 0.08);
          context.beginPath();
          context.arc(BASE.x, tipY, (low ? 0.8 : 1) * ring * 1.7, 0, Math.PI * 2);
          context.fill();
        }
        context.globalAlpha = 1;
      }

      // Smoke: one thread from the tip, swaying more the higher it rises.
      const smoke = lit ? 1 : state.state === "out" && !still ? Math.max(0, 1 - outFor / FADE_OUT_MS) : 0;
      if (smoke > 0) {
        const source = tipY - ash - 1;
        const rise = state.state === "out" ? (outFor / FADE_OUT_MS) * 30 : 0;
        const span = source - SMOKE_TOP;
        const time = still ? 0 : now;
        const draught = 0.05 + 0.22 * level;
        context.strokeStyle = SMOKE;
        context.lineWidth = state.state === "ember" ? 0.7 : 0.9;
        const perBand = SMOKE_POINTS / SMOKE_BANDS;
        for (let band = 0; band < SMOKE_BANDS; band += 1) {
          context.globalAlpha = smoke * (0.42 - band * 0.1);
          context.beginPath();
          for (let point = band * perBand; point <= (band + 1) * perBand; point += 1) {
            const height = (point / SMOKE_POINTS) * span;
            const y = source - height - rise;
            const x =
              BASE.x +
              height * draught * Math.sin(height * 0.075 - time / 900) +
              height * 0.04 * Math.sin(height * 0.031 + time / 1400);
            if (point === band * perBand) context.moveTo(x, y);
            else context.lineTo(x, y);
          }
          context.stroke();
        }
        context.globalAlpha = 1;
      }

      // The burner in front of the stick's foot.
      const bowl = () => {
        context.beginPath();
        context.moveTo(BASE.x - 27, BASE.y);
        context.quadraticCurveTo(BASE.x - 25, BASE.y + 11, BASE.x - 14, BASE.y + 12);
        context.lineTo(BASE.x + 14, BASE.y + 12);
        context.quadraticCurveTo(BASE.x + 25, BASE.y + 11, BASE.x + 27, BASE.y);
        context.closePath();
      };
      context.fillStyle = BRONZE;
      bowl();
      context.fill();
      context.fillStyle = ASH_BED;
      context.globalAlpha = 0.55;
      context.beginPath();
      context.ellipse(BASE.x, BASE.y, 23, 3.4, 0, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = BRONZE_RIM;
      context.lineWidth = 0.7;
      context.beginPath();
      context.ellipse(BASE.x, BASE.y, 27, 4.4, 0, 0, Math.PI * 2);
      context.stroke();

      // The ember's faint warmth on the bronze and the ash bed, stronger as it burns down.
      const light = glow > 0 && length > 0.5 ? emberGlow() : null;
      if (light) {
        const near = 1 - Math.min(1, (BASE.y - tipY) / STICK);
        const breath = still ? 1 : 0.85 + 0.15 * Math.sin(now / 760);
        context.save();
        bowl();
        context.rect(BASE.x - 27, BASE.y - 5, 54, 5);
        context.clip();
        context.globalAlpha = glow * breath * (0.06 + 0.3 * near * near);
        context.drawImage(light, BASE.x - GLOW.w / 2, BASE.y - GLOW.h / 2 + 1, GLOW.w, GLOW.h);
        context.restore();
      }
    };

    const paint = (now: number, level: number, still: boolean) => {
      const context = prepareCanvas(canvasRef.current, WIDTH);
      if (context) draw(context, now, level, still);
    };

    if (!visible || reducedMotion) {
      state.burnt = state.target;
      state.fallStart = -1;
      paint(performance.now(), 0, true);
      return;
    }

    let frame = 0;
    let last = performance.now();
    let level = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // The stick eases down to its new length over a page turn.
      state.burnt += (state.target - state.burnt) * Math.min(1, dt * 3);
      if (Math.abs(state.target - state.burnt) < 0.0005) state.burnt = state.target;
      if (state.burnt < state.ashFrom) state.ashFrom = state.burnt; // paging back
      if (state.fallStart >= 0 && now - state.fallStart >= FALL_MS) state.fallStart = -1;
      const lit = state.state === "burning" || state.state === "ember";
      if (lit && state.fallStart < 0 && (state.burnt - state.ashFrom) * (STICK - HANDLE) >= ASH_MAX) {
        // The column is long enough to break: it drops into the bowl.
        state.fallStart = now;
        state.fallLength = ASH_MAX;
        state.fallY = BASE.y - HANDLE - (STICK - HANDLE) * (1 - state.burnt);
        state.ashFrom = state.burnt;
      }
      const heard = reactive && lit ? reactiveLevel() : 0;
      level += (heard - level) * Math.min(1, dt * 2);
      paint(now, level, false);
      const fading = state.state === "out" && now - state.outStart < FADE_OUT_MS;
      const busy = lit || fading || state.fallStart >= 0 || state.burnt !== state.target;
      if (busy) frame = window.requestAnimationFrame(tick);
    };
    tick(last);
    return () => window.cancelAnimationFrame(frame);
  }, [burnt, key, reactive, reducedMotion, visible]);

  return <canvas className="instrument__incense" ref={canvasRef} />;
}
