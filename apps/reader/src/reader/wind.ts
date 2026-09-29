import type { CompassPoint } from "./types";

/** Compass bearings, clockwise from north. */
export const BEARING: Record<CompassPoint, number> = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };

/** The way the wind blows, clockwise from north: a south-west wind blows toward the north-east. */
export function flowBearing(from: CompassPoint): number {
  return (BEARING[from] + 180) % 360;
}

/** The target angle nearest to `current`, so the arrow swings the short way round. */
export function nearestTurn(current: number, target: number): number {
  return current + ((((target - current) % 360) + 540) % 360) - 180;
}
