import { useEffect, useState } from "react";

interface BackgroundStageProps {
  src: string | null;
  durationMs: number;
  reducedMotion: boolean;
  hidden: boolean;
}

export function BackgroundStage({
  src,
  durationMs,
  reducedMotion,
  hidden,
}: BackgroundStageProps) {
  const [layers, setLayers] = useState<{
    current: string | null;
    previous: string | null;
  }>({ current: src, previous: null });

  // Adjusting during render (rather than in an effect) means the outgoing layer
  // is already mounted on the first frame of the crossfade.
  if (src !== layers.current) {
    setLayers({ current: src, previous: layers.current });
  }

  useEffect(() => {
    if (!layers.previous) return;
    const timeout = window.setTimeout(
      () => setLayers((state) => ({ ...state, previous: null })),
      reducedMotion ? 0 : durationMs + 80,
    );
    return () => window.clearTimeout(timeout);
  }, [durationMs, layers.previous, reducedMotion]);

  const transitionDuration = reducedMotion ? 0 : durationMs;

  return (
    <div className={`background-stage${hidden ? " is-hidden" : ""}`} aria-hidden="true">
      {layers.previous ? (
        <div
          className="background-layer"
          style={{ backgroundImage: `url(${layers.previous})` }}
        />
      ) : null}
      {layers.current ? (
        <div
          key={layers.current}
          className="background-layer background-layer--current"
          style={{
            backgroundImage: `url(${layers.current})`,
            animationDuration: `${transitionDuration}ms`,
          }}
        />
      ) : null}
      <div className="background-shade" />
      <div className="background-grain" />
    </div>
  );
}
