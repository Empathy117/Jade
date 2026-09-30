import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CARVE_STROKES } from "./carve";
import { Gesture, GRIND_TURNS } from "./Gesture";
import { fakeCanvasContext } from "./testCanvas";
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

const carve: GestureCue = {
  id: "gesture_003",
  kind: "carve_wood",
  at: "p0004",
  placement: "center",
  params: { stage: "finish" },
  sound: { asset_id: "sfx_knife", gain: 0.35 },
};

/** Drag the knife across the block, in the plate's 200 × 140 drawing units. */
function stroke(target: HTMLElement, y: number, fromX = 60, toX = 140) {
  fireEvent.pointerDown(target, { pointerId: 1, clientX: fromX, clientY: y });
  for (let step = 1; step <= 10; step += 1) {
    fireEvent.pointerMove(target, { pointerId: 1, clientX: fromX + ((toX - fromX) * step) / 10, clientY: y + step });
  }
  fireEvent.pointerUp(target, { pointerId: 1 });
}

describe("Gesture: carve_wood", () => {
  let calls: string[];
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    calls = fakeCanvasContext().calls;
    // Lay the carving's canvas out at its drawing size so screen and drawing units agree.
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 200, bottom: 140, width: 200, height: 140, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pares the block stroke by stroke and finishes once", () => {
    const onComplete = vi.fn();
    render(plate({ cue: carve, serial: 1, active: true }, { onComplete }));
    expect(document.querySelector(".gesture__carving")).not.toBeNull();
    expect(document.querySelector(".gesture__hint")?.textContent).toBe("削木");
    expect(element().getAttribute("aria-label")).toBe("削木，可跳过");

    stroke(element(), 30);
    stroke(element(), 60);
    expect(onComplete).not.toHaveBeenCalled();
    expect(element().classList.contains("is-finished")).toBe(false);

    for (let count = 0; count < CARVE_STROKES; count += 1) stroke(element(), 14 + ((count * 23) % 110));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(element().classList.contains("is-finished")).toBe(true);
  });

  it("throws off shavings as it cuts, then comes to rest", () => {
    render(plate({ cue: carve, serial: 1, active: true }));
    calls.length = 0;
    stroke(element(), 40);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(calls).toContain("arc");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const request = vi.spyOn(window, "requestAnimationFrame");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("does not carve outside the block", () => {
    const onComplete = vi.fn();
    render(plate({ cue: carve, serial: 1, active: true }, { onComplete }));
    calls.length = 0;
    for (let count = 0; count < CARVE_STROKES - 1; count += 1) stroke(element(), 70, 2, 40);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // Strokes off the block count toward nothing and throw off no shavings.
    expect(calls).not.toContain("arc");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("keeps its input from turning the page", () => {
    const onParent = vi.fn();
    render(plate({ cue: carve, serial: 1, active: true }, { onParent }));
    stroke(element(), 50);
    fireEvent.click(element());
    expect(onParent).not.toHaveBeenCalled();
  });

  it("completes on Enter, and with one press under reduced motion", () => {
    const onComplete = vi.fn();
    const { unmount } = render(plate({ cue: carve, serial: 1, active: true }, { onComplete }));
    fireEvent.keyDown(element(), { key: "Enter" });
    expect(onComplete).toHaveBeenCalledTimes(1);
    unmount();

    const pressed = vi.fn();
    render(plate({ cue: carve, serial: 2, active: true }, { onComplete: pressed, reducedMotion: true }));
    fireEvent.pointerDown(element(), { pointerId: 1, clientX: 100, clientY: 60 });
    expect(pressed).toHaveBeenCalledTimes(1);
    expect(element().classList.contains("is-finished")).toBe(true);
  });

  it("shows the figure finished when the reader turns past it", () => {
    const onComplete = vi.fn();
    const { rerender } = render(plate({ cue: carve, serial: 1, active: true }, { onComplete }));
    stroke(element(), 40);
    rerender(plate({ cue: carve, serial: 1, active: false }, { onComplete }));
    expect(element().classList.contains("is-finished")).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();
    // The rest of the waste fades away, then the plate rests.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    const request = vi.spyOn(window, "requestAnimationFrame");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(request).not.toHaveBeenCalled();
  });
});
