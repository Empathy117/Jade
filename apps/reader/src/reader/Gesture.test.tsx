import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Gesture, GRIND_TURNS } from "./Gesture";
import type { GestureCue, GestureKind } from "./types";
import type { GestureRun } from "./useStaging";

const grind: GestureCue = {
  id: "gesture_001",
  kind: "grind_ink",
  at: "p0002",
  placement: "center",
  params: { direction: "ccw", tone: "pale" },
};
const seal: GestureCue = {
  id: "gesture_002",
  kind: "press_seal",
  at: "p0003",
  placement: "center",
  params: {},
  sound: { asset_id: "sfx_seal", gain: 0.4 },
};

function plate(
  run: GestureRun,
  {
    onComplete = vi.fn(),
    reducedMotion = false,
    hidden = false,
    learned = new Set<GestureKind>(),
    onParent = vi.fn(),
  } = {},
) {
  return (
    <div onPointerDown={onParent} onClick={onParent}>
      <Gesture
        run={run}
        layout="nvl"
        reducedMotion={reducedMotion}
        hidden={hidden}
        learned={learned}
        onComplete={onComplete}
        viewportRef={{ current: null }}
      />
    </div>
  );
}

function element(): HTMLElement {
  return document.querySelector(".gesture") as HTMLElement;
}

/** Drag around the stone's centre (jsdom lays everything out at 0,0). */
function circle(target: HTMLElement, turns: number, direction: 1 | -1 = -1) {
  const steps = Math.ceil(turns * 16);
  fireEvent.pointerDown(target, { pointerId: 1, clientX: 40, clientY: 0 });
  for (let step = 1; step <= steps; step += 1) {
    const angle = (direction * step * 2 * Math.PI) / 16;
    fireEvent.pointerMove(target, {
      pointerId: 1,
      clientX: 40 * Math.cos(angle),
      clientY: 40 * Math.sin(angle),
    });
  }
  fireEvent.pointerUp(target, { pointerId: 1 });
}

describe("Gesture", () => {
  it("finishes grinding after enough turns, once", () => {
    const onComplete = vi.fn();
    render(plate({ cue: grind, serial: 1, active: true }, { onComplete }));
    circle(element(), GRIND_TURNS / 2);
    expect(onComplete).not.toHaveBeenCalled();
    expect(element().classList.contains("is-finished")).toBe(false);

    circle(element(), GRIND_TURNS);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(element().classList.contains("is-finished")).toBe(true);
  });

  it("grinds in either direction; the arrow is only a hint", () => {
    const onComplete = vi.fn();
    render(plate({ cue: grind, serial: 1, active: true }, { onComplete }));
    expect(document.querySelector(".gesture__arrow")).not.toBeNull();
    circle(element(), GRIND_TURNS + 0.5, 1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("still grinds when the browser refuses pointer capture", () => {
    // jsdom has no pointer capture; install one that refuses, as a browser
    // does for a pointer it no longer tracks.
    const prototype = HTMLElement.prototype as Partial<HTMLElement>;
    prototype.setPointerCapture = () => {
      throw new DOMException("No active pointer with the given id is found.", "NotFoundError");
    };
    try {
      const onComplete = vi.fn();
      render(plate({ cue: grind, serial: 1, active: true }, { onComplete }));
      circle(element(), GRIND_TURNS + 0.5);
      expect(onComplete).toHaveBeenCalledTimes(1);
    } finally {
      delete prototype.setPointerCapture;
    }
  });

  it("keeps its input from turning the page", () => {
    const onParent = vi.fn();
    render(plate({ cue: grind, serial: 1, active: true }, { onParent }));
    fireEvent.pointerDown(element(), { pointerId: 1, clientX: 40, clientY: 0 });
    fireEvent.click(element());
    expect(onParent).not.toHaveBeenCalled();
    expect(element().dataset.interactive).toBe("true");
  });

  it("completes on Enter", () => {
    const onComplete = vi.fn();
    render(plate({ cue: grind, serial: 1, active: true }, { onComplete }));
    fireEvent.keyDown(element(), { key: " " });
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.keyDown(element(), { key: "Enter" });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("becomes a single press with reduced motion", () => {
    const onComplete = vi.fn();
    render(plate({ cue: grind, serial: 1, active: true }, { onComplete, reducedMotion: true }));
    fireEvent.pointerDown(element(), { pointerId: 1, clientX: 40, clientY: 0 });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("presses a seal with one press", () => {
    const onComplete = vi.fn();
    render(plate({ cue: seal, serial: 1, active: true }, { onComplete }));
    fireEvent.pointerDown(element(), { pointerId: 1, clientX: 0, clientY: 0 });
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ cue: seal }));
    expect(element().classList.contains("is-finished")).toBe(true);
  });

  it("shows finished without completing when the reader turns past it", () => {
    const onComplete = vi.fn();
    const { rerender } = render(plate({ cue: seal, serial: 1, active: true }, { onComplete }));
    rerender(plate({ cue: seal, serial: 1, active: false }, { onComplete }));
    expect(element().classList.contains("is-finished")).toBe(true);
    expect(element().classList.contains("is-visible")).toBe(false);
    fireEvent.pointerDown(element(), { pointerId: 1, clientX: 0, clientY: 0 });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("starts unfinished for a new run", () => {
    const { rerender } = render(plate({ cue: seal, serial: 1, active: true }));
    fireEvent.pointerDown(element(), { pointerId: 1, clientX: 0, clientY: 0 });
    rerender(plate({ cue: grind, serial: 2, active: true }));
    expect(element().classList.contains("is-finished")).toBe(false);
  });

  it("hides the hint once the kind is learned, and everything in pure mode", () => {
    const { rerender } = render(plate({ cue: grind, serial: 1, active: true }));
    expect(document.querySelector(".gesture__hint.is-shown")).not.toBeNull();
    rerender(plate({ cue: grind, serial: 1, active: true }, { learned: new Set(["grind_ink"]) }));
    expect(document.querySelector(".gesture__hint.is-shown")).toBeNull();
    rerender(plate({ cue: grind, serial: 1, active: true }, { hidden: true }));
    expect(element().classList.contains("is-visible")).toBe(false);
  });
});
