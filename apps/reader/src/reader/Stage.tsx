import { useEffect, useRef, useState } from "react";
import { Particles } from "./Particles";
import { cameraTransform, IDENTITY_CAMERA, type CameraState } from "./staging";
import type { AtmosphereState, GradeState, Transition } from "./types";
import type { MomentRun } from "./useStaging";

/** One slow ease-out for every page-turn camera move; no springs, no overshoot. */
const CAMERA_EASE = "cubic-bezier(.22,.61,.36,1)";
const CAMERA_STEP_MS = 1800;
const MOMENT_IN_MS = 900;
const MOMENT_OUT_MS = 1400;
const BASE_SATURATION = 0.72;
const CG_OUT_MS = 900;

/** Event art resolved to a URL, with how it should arrive. */
export interface StageCg {
  id: string;
  src: string;
  transition: Transition;
  durationMs: number;
}

/** A heartbeat of the vignette; a new serial beats again. */
export interface StagePulse {
  serial: number;
  intensity: number;
  durationMs: number;
}

interface StageProps {
  src: string | null;
  durationMs: number;
  transition: Transition;
  camera: CameraState;
  /** The last move was a page turn; a jump settles the frame without travel. */
  stepped: boolean;
  grade: GradeState | null;
  moment: MomentRun | null;
  cg: StageCg | null;
  atmosphere: AtmosphereState;
  pulse: StagePulse | null;
  reducedMotion: boolean;
  hidden: boolean;
}

interface Layer {
  src: string;
  camera: CameraState;
}

/**
 * The picture behind the page: plate, camera, grade, and moment overlays.
 *
 * Layer order is plate → grade → shade → flicker → event art → particles →
 * moment overlays; the reading surface sits above all of it and is never moved
 * by the camera.
 */
export function Stage({
  src,
  durationMs,
  transition,
  camera,
  stepped,
  grade,
  moment,
  cg,
  atmosphere,
  pulse,
  reducedMotion,
  hidden,
}: StageProps) {
  const [layers, setLayers] = useState<{ current: string | null; previous: Layer | null }>({
    current: src,
    previous: null,
  });
  const [lastCamera, setLastCamera] = useState<CameraState>(camera);

  // The outgoing plate keeps the framing it had, so a crossfade never drags
  // the old image into the new one's composition.
  if (src !== layers.current) {
    setLayers({
      current: src,
      previous: layers.current ? { src: layers.current, camera: lastCamera } : null,
    });
  }
  if (camera !== lastCamera) setLastCamera(camera);

  const [cgLayers, setCgLayers] = useState<{ current: StageCg | null; previous: StageCg | null }>({
    current: cg,
    previous: null,
  });
  if (cg?.id !== cgLayers.current?.id) {
    setCgLayers({ current: cg, previous: cgLayers.current });
  }
  useEffect(() => {
    if (!cgLayers.previous) return;
    const timeout = window.setTimeout(
      () => setCgLayers((state) => ({ ...state, previous: null })),
      reducedMotion ? 0 : CG_OUT_MS + 80,
    );
    return () => window.clearTimeout(timeout);
  }, [cgLayers.previous, reducedMotion]);

  const pulseRef = useRef<HTMLDivElement | null>(null);
  const pulseSerial = pulse?.serial;
  useEffect(() => {
    const element = pulseRef.current;
    if (!pulse || !element || reducedMotion || typeof element.animate !== "function") return;
    // Two beats, the second softer: lub-dub.
    const peak = 0.35 + 0.65 * pulse.intensity;
    element.animate(
      [
        { opacity: 0 },
        { opacity: peak, offset: 0.12 },
        { opacity: 0.1, offset: 0.3 },
        { opacity: peak * 0.7, offset: 0.42 },
        { opacity: 0 },
      ],
      { duration: pulse.durationMs, easing: "ease-out" },
    );
    // Only a new serial beats again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseSerial]);

  useEffect(() => {
    if (!layers.previous) return;
    const timeout = window.setTimeout(
      () => setLayers((state) => ({ ...state, previous: null })),
      reducedMotion ? 0 : durationMs + 80,
    );
    return () => window.clearTimeout(timeout);
  }, [durationMs, layers.previous, reducedMotion]);

  const active = moment?.active ? moment.cue : null;
  const params = moment?.cue.params ?? {};
  const momentMs = active ? (params.in_ms ?? MOMENT_IN_MS) : (params.out_ms ?? MOMENT_OUT_MS);
  const isolate = active?.template === "isolate_line";
  const letterbox =
    active && (active.template === "letterbox_hold" || params.letterbox !== undefined)
      ? (params.letterbox ?? 0.12)
      : 0;

  const cameraMs = reducedMotion || !stepped
    ? 0
    : active?.template === "slow_reveal"
      ? (params.in_ms ?? CAMERA_STEP_MS * 2)
      : CAMERA_STEP_MS;
  const blur = reducedMotion ? 0 : camera.blur + (isolate ? (params.blur_px ?? 0) : 0);
  const saturation = BASE_SATURATION * (grade?.saturation ?? 1);
  const gradeMs = reducedMotion ? 0 : (grade?.duration_ms ?? 0);
  const arrival = (kind: Transition) =>
    !reducedMotion && (kind === "iris" || kind === "wipe") ? ` is-arriving-${kind}` : "";

  return (
    <div className={`background-stage${hidden ? " is-hidden" : ""}`} aria-hidden="true">
      {layers.previous ? (
        <Plate
          src={layers.previous.src}
          camera={layers.previous.camera}
          style={{ filter: `saturate(${saturation})` }}
        />
      ) : null}
      {layers.current ? (
        <Plate
          key={layers.current}
          src={layers.current}
          current
          arrival={arrival(transition)}
          camera={camera}
          drift={reducedMotion ? 0 : camera.drift}
          style={{
            animationDuration: `${reducedMotion ? 0 : durationMs}ms`,
            filter: `saturate(${saturation}) blur(${blur}px)`,
            transition: `transform ${cameraMs}ms ${CAMERA_EASE}, filter ${momentMs}ms ease`,
          }}
        />
      ) : null}
      <div
        className="stage-grade"
        style={{
          backgroundColor: grade?.tint ?? "transparent",
          opacity: grade ? grade.shade : 0,
          transition: `opacity ${gradeMs}ms ease, background-color ${gradeMs}ms ease`,
        }}
      />
      <div className="background-shade" />
      <div className="background-grain" />
      <div
        className={`stage-flicker${atmosphere.flicker > 0 && !reducedMotion ? " is-active" : ""}`}
        style={{ "--flicker": atmosphere.flicker } as React.CSSProperties}
      />
      {cgLayers.previous ? (
        <div
          className="stage-cg is-leaving"
          style={{
            backgroundImage: `url(${cgLayers.previous.src})`,
            animationDuration: `${reducedMotion ? 0 : CG_OUT_MS}ms`,
          }}
        />
      ) : null}
      {cgLayers.current ? (
        <div
          key={cgLayers.current.id}
          className={`stage-cg${arrival(cgLayers.current.transition)}`}
          style={{ animationDuration: `${reducedMotion ? 0 : cgLayers.current.durationMs}ms` }}
        >
          <div
            className={`stage-cg__image${reducedMotion ? "" : " is-drifting"}`}
            style={{ backgroundImage: `url(${cgLayers.current.src})` }}
          />
        </div>
      ) : null}
      <Particles
        kind={atmosphere.particles}
        density={atmosphere.density}
        hidden={hidden || reducedMotion}
      />
      <div className="stage-pulse" ref={pulseRef} />
      <div
        className="stage-isolate"
        style={{
          opacity: isolate ? (params.dim ?? 0.6) : 0,
          transition: `opacity ${momentMs}ms ease`,
        }}
      />
      <div
        className={`stage-letterbox${letterbox > 0 ? " is-active" : ""}`}
        style={
          {
            "--letterbox": `${letterbox * 100}%`,
            "--letterbox-ms": `${momentMs}ms`,
          } as React.CSSProperties
        }
      />
      {active?.template === "flash_cut" && !reducedMotion ? (
        <div
          key={moment?.serial}
          className={`stage-flash stage-flash--${params.flash ?? "white"}`}
          style={{ animationDuration: `${params.out_ms ?? 600}ms` }}
        />
      ) : null}
    </div>
  );
}

function Plate({
  src,
  camera = IDENTITY_CAMERA,
  drift = 0,
  current = false,
  arrival = "",
  style,
}: {
  src: string;
  camera?: CameraState;
  drift?: number;
  current?: boolean;
  arrival?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`background-layer${current ? " background-layer--current" : ""}${arrival}`}
      style={style}
    >
      <div className="stage-camera" style={{ transform: cameraTransform(camera), transition: "inherit" }}>
        <div
          className={`stage-plate${drift > 0 ? " is-drifting" : ""}`}
          style={
            {
              backgroundImage: `url(${src})`,
              "--drift-scale": 1 + drift,
            } as React.CSSProperties
          }
        />
      </div>
    </div>
  );
}
