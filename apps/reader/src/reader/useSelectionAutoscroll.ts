import { useEffect, useState } from "react";
import type { RefObject } from "react";

import { caretAt } from "./passageSelection";
import { isTap } from "./touch";

/**
 * Sweeping a selection past the edge of the text.
 *
 * Earlier beats of the scene sit above the fold, and browsers only scroll a
 * selection sweep once the pointer is at or beyond the viewport's very edge —
 * a strip the fade mask hides. While a pointer sweeps a selection, bands at
 * both edges light up instead: pushing into one scrolls the text under the
 * pointer, gently at the band's inner edge and briskly at the rim, and the
 * selection follows. Where the browser's own autoscroll is already moving the
 * text, the bands step aside rather than doubling its speed.
 */

/** How far into the text, from either edge, the pull begins. */
export const EDGE_BAND = 64;
/** Pixels per second: about two lines at the band's inner edge, eighteen at the rim. */
const MIN_SPEED = 90;
const MAX_SPEED = 720;
/** A stalled frame (a throttled tab) must not turn into one long lurch. */
const MAX_FRAME_MS = 50;
/** An outside scroll this recent (native autoscroll, a wheel) holds ours back. */
const NATIVE_YIELD_MS = 160;

export type ScrollEdge = "up" | "down";

export interface EdgePull {
  edge: ScrollEdge | null;
  /** 0 at the band's inner edge, 1 at the viewport edge and beyond. */
  strength: number;
}

export function edgePull(
  pointerY: number,
  top: number,
  bottom: number,
  band: number = EDGE_BAND,
): EdgePull {
  const size = Math.max(1, Math.min(band, (bottom - top) / 4));
  if (pointerY < top + size) {
    return { edge: "up", strength: Math.min(1, (top + size - pointerY) / size) };
  }
  if (pointerY > bottom - size) {
    return { edge: "down", strength: Math.min(1, (pointerY - (bottom - size)) / size) };
  }
  return { edge: null, strength: 0 };
}

/** Pixels per second for a pull of `strength`. */
export function edgeSpeed(strength: number): number {
  return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * strength * strength;
}

export interface SelectionSweep {
  /** A pointer is sweeping a selection through the text. */
  sweeping: boolean;
  /** Edges with more text beyond them. */
  room: { up: boolean; down: boolean };
  /** The edge scrolling right now. */
  pulling: ScrollEdge | null;
}

const IDLE: SelectionSweep = { sweeping: false, room: { up: false, down: false }, pulling: null };

function sameSweep(a: SelectionSweep, b: SelectionSweep): boolean {
  return (
    a.sweeping === b.sweeping &&
    a.pulling === b.pulling &&
    a.room.up === b.room.up &&
    a.room.down === b.room.down
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

export function useSelectionAutoscroll(
  viewportRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): SelectionSweep {
  const [sweep, setSweep] = useState<SelectionSweep>(IDLE);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!enabled || !viewport) return;

    let press: { x: number; y: number } | null = null;
    let pointer = { x: 0, y: 0 };
    let sweeping = false;
    let frame = 0;
    let frameAt = 0;
    let expectedTop = 0;
    let carry = 0;
    let outsideScrollAt = Number.NEGATIVE_INFINITY;
    let published = IDLE;

    const publish = (next: SelectionSweep) => {
      if (sameSweep(next, published)) return;
      published = next;
      setSweep(next);
    };

    const room = () => {
      const limit = viewport.scrollHeight - viewport.clientHeight;
      return { up: viewport.scrollTop > 1, down: viewport.scrollTop < limit - 1 };
    };

    // Keep the selection's moving end under the pointer as text slides past it.
    const followPointer = (bounds: DOMRect) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const column = viewport.firstElementChild?.getBoundingClientRect() ?? bounds;
      const caret = caretAt(
        clamp(pointer.x, column.left + 2, column.right - 2),
        clamp(pointer.y, bounds.top + 4, bounds.bottom - 4),
      );
      if (!caret || !viewport.contains(caret.node)) return;
      try {
        selection.extend(caret.node, caret.offset);
      } catch {
        // The caret landed on a node React is replacing; the next frame retries.
      }
    };

    const step = () => {
      frame = 0;
      if (!sweeping) return;
      const bounds = viewport.getBoundingClientRect();
      const { edge, strength } = edgePull(pointer.y, bounds.top, bounds.bottom);
      const space = room();
      const pulling = edge && space[edge] ? edge : null;
      publish({ sweeping: true, room: space, pulling });
      if (!pulling) return;

      const now = performance.now();
      const elapsed = Math.min(now - frameAt, MAX_FRAME_MS);
      frameAt = now;
      if (Math.abs(viewport.scrollTop - expectedTop) >= 1) outsideScrollAt = now;
      if (now - outsideScrollAt > NATIVE_YIELD_MS) {
        carry += ((edgeSpeed(strength) * elapsed) / 1000) * (pulling === "up" ? -1 : 1);
        const whole = Math.trunc(carry);
        if (whole !== 0) {
          viewport.scrollTop += whole;
          carry -= whole;
        }
        followPointer(bounds);
      }
      expectedTop = viewport.scrollTop;
      frame = window.requestAnimationFrame(step);
    };

    const ensureLoop = () => {
      if (frame !== 0) return;
      frameAt = performance.now();
      expectedTop = viewport.scrollTop;
      carry = 0;
      frame = window.requestAnimationFrame(step);
    };

    const halt = () => {
      press = null;
      sweeping = false;
      if (frame !== 0) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const stop = () => {
      halt();
      publish(IDLE);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      if ((event.target as Element | null)?.closest("[data-interactive='true']")) return;
      press = { x: event.clientX, y: event.clientY };
      pointer = press;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!press) return;
      if ((event.buttons & 1) === 0) {
        stop();
        return;
      }
      pointer = { x: event.clientX, y: event.clientY };
      if (!sweeping) {
        if (isTap(pointer.x - press.x, pointer.y - press.y)) return;
        if (window.getSelection()?.isCollapsed ?? true) return;
        sweeping = true;
      }
      ensureLoop();
    };

    const onScroll = () => {
      if (sweeping) publish({ ...published, room: room() });
    };

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    return () => {
      halt();
      setSweep(IDLE);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
    };
  }, [enabled, viewportRef]);

  return enabled ? sweep : IDLE;
}
