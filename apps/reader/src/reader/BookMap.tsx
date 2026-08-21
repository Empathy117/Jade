import { useEffect, useRef, useState } from "react";

import type { MapView } from "./codex";

const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface MapTransform {
  scale: number;
  tx: number;
  ty: number;
}

const FIT: MapTransform = { scale: 1, tx: 0, ty: 0 };

interface BookMapProps {
  map: MapView;
  src: string;
  selectedPlaceId: string | null;
  /** The current scene's place on this map — the you-are-here marker. */
  activePlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
}

/**
 * Pan/zoom viewer for one dossier map.
 *
 * Marker positions live in the map's own coordinate space and are placed by
 * percentage, so the artwork can be any raster or vector image. Markers keep
 * a constant on-screen size by inverting the canvas scale.
 */
export function BookMap({
  map,
  src,
  selectedPlaceId,
  activePlaceId,
  onSelectPlace,
}: BookMapProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<MapTransform>(FIT);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const clampTransform = (next: MapTransform): MapTransform => {
    const stage = stageRef.current;
    if (!stage) return next;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    return {
      scale: next.scale,
      tx: Math.min(0, Math.max(width * (1 - next.scale), next.tx)),
      ty: Math.min(0, Math.max(height * (1 - next.scale), next.ty)),
    };
  };

  const zoomAt = (clientX: number, clientY: number, factor: number): void => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    setTransform((current) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      const ratio = scale / current.scale;
      return clampTransform({
        scale,
        tx: cx - (cx - current.tx) * ratio,
        ty: cy - (cy - current.ty) * ratio,
      });
    });
  };

  const zoomCentered = (factor: number): void => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  // Wheel zoom must preventDefault, which React's synthetic listener cannot,
  // so the listener is attached natively as non-passive.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
    // zoomAt reads state through the setter, so the handler never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // jsdom has no pointer capture; a drag there just loses the pointer early.
    stageRef.current?.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const active = [...pointers.current.entries()];
    if (active.length === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      setTransform((current) =>
        clampTransform({ ...current, tx: current.tx + dx, ty: current.ty + dy }),
      );
    } else if (active.length === 2) {
      const other = active.find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const previousDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
        const distance = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (previousDistance > 0) {
          zoomAt(
            (event.clientX + other.x) / 2,
            (event.clientY + other.y) / 2,
            distance / previousDistance,
          );
        }
      }
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
  }

  const markerScale = 1 / transform.scale;

  return (
    <div
      ref={stageRef}
      className={`map-stage${transform.scale > 1 ? " is-zoomed" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div
        className="map-canvas"
        style={{
          aspectRatio: `${map.map.width} / ${map.map.height}`,
          transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
        }}
      >
        <img src={src} alt={map.map.title} draggable={false} />
        {map.markers.map(({ marker, place }) => {
          const isActive = marker.place_id === activePlaceId;
          return (
            <button
              key={marker.place_id}
              type="button"
              className={`map-marker${marker.place_id === selectedPlaceId ? " is-selected" : ""}${isActive ? " is-here" : ""}`}
              style={{
                left: `${(marker.x / map.map.width) * 100}%`,
                top: `${(marker.y / map.map.height) * 100}%`,
                transform: `translate(-50%, -50%) scale(${markerScale})`,
              }}
              aria-label={isActive ? `${place.place.name}（你在这里）` : place.place.name}
              title={place.place.name}
              onClick={() => onSelectPlace(marker.place_id)}
            >
              {isActive ? <span className="map-marker__ring" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <div className="map-tools">
        <button type="button" aria-label="放大" onClick={() => zoomCentered(1.4)}>
          ＋
        </button>
        <button type="button" aria-label="缩小" onClick={() => zoomCentered(1 / 1.4)}>
          －
        </button>
        <button type="button" aria-label="复位" onClick={() => setTransform(FIT)}>
          ⤢
        </button>
      </div>
    </div>
  );
}
