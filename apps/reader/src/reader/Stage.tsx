import { useEffect, useState } from "react";
import { cameraTransform, IDENTITY_CAMERA, type CameraState } from "./staging";
import type { GradeState } from "./types";
import type { MomentRun } from "./useStaging";

/** One slow ease-out for every page-turn camera move; no springs, no overshoot. */
const CAMERA_EASE = "cubic-bezier(.22,.61,.36,1)";
const CAMERA_STEP_MS = 1800;
const MOMENT_IN_MS = 900;
const MOMENT_OUT_MS = 1400;
const BASE_SATURATION = 0.72;

interface StageProps {
  src: string | null;
  durationMs: number;
  camera: CameraState;
  /** The last move was a page turn; a jump settles the frame without travel. */
  stepped: boolean;
  grade: GradeState | null;
  moment: MomentRun | null;
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
 * Layer order is plate → grade → shade → moment overlays; the reading surface
 * sits above all of it and is never moved by the camera.
 */
export function Stage({
  src,
  durationMs,
  camera,
  stepped,
  grade,
  moment,
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
        className="stage-isolate"
        style={{
          opacity: isolate ? (params.dim ?? 0.6) : 0,
          transition: `opacity ${momentMs}ms ease`,
        }}
      />
      <div
        className="stage-letterbox"
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
  style,
}: {
  src: string;
  camera?: CameraState;
  drift?: number;
  current?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`background-layer${current ? " background-layer--current" : ""}`}
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
