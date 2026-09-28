import { useEffect, useRef } from "react";
import type { ParticleKind } from "./types";

interface ParticlesProps {
  kind: ParticleKind | null;
  density: number;
  hidden: boolean;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
}

const MAX_MOTES = 110;

/**
 * Procedural atmosphere drawn on a canvas: no asset, no licence, and it costs
 * nothing when a scene has none. Dust is lit motes drifting slowly upward, as
 * in a shaft of light through a door left ajar.
 */
export function Particles({ kind, density, hidden }: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !kind || hidden || density <= 0) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = Math.round(MAX_MOTES * Math.min(1, density));
    const motes: Mote[] = Array.from({ length: count }, () => spawn(canvas, true));
    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < motes.length; index += 1) {
        const mote = motes[index];
        mote.phase += dt * 0.6;
        mote.x += (mote.vx + Math.sin(mote.phase) * 4) * dt * ratio;
        mote.y += mote.vy * dt * ratio;
        if (mote.y < -10 || mote.x < -10 || mote.x > canvas.width + 10) {
          motes[index] = spawn(canvas, false);
          continue;
        }
        const twinkle = 0.18 + 0.2 * Math.sin(mote.phase * 2.3);
        const radius = mote.r * ratio;
        const glow = context.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, radius * 2.4);
        glow.addColorStop(0, `rgba(255, 238, 205, ${twinkle})`);
        glow.addColorStop(1, "rgba(255, 238, 205, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(mote.x, mote.y, radius * 2.4, 0, Math.PI * 2);
        context.fill();
      }
      frame = window.requestAnimationFrame(draw);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [density, hidden, kind]);

  return <canvas className={`stage-particles${kind && !hidden ? " is-active" : ""}`} ref={canvasRef} />;
}

function spawn(canvas: HTMLCanvasElement, anywhere: boolean): Mote {
  return {
    x: Math.random() * canvas.width,
    y: anywhere ? Math.random() * canvas.height : canvas.height + Math.random() * 20,
    r: 0.35 + Math.random() * 0.9,
    vx: (Math.random() - 0.5) * 6,
    vy: -(4 + Math.random() * 10),
    phase: Math.random() * Math.PI * 2,
  };
}
