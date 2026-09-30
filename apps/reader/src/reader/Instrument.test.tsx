import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Instrument } from "./Instrument";
import { sheetsTurned } from "./letter";
import { holeAt, PIANOLA_ROWS, PIANOLA_TRACKS, punchRoll } from "./pianola";
import type { InstrumentReading } from "./staging";
import { fakeCanvasContext } from "./testCanvas";
import type { InstrumentCue, InstrumentKey, LetterKey, PianolaKey, RadioKey, WindKey } from "./types";

const listening: RadioKey = {
  at: "p0002",
  state: "listening",
  frequency: "14.195",
  signal: 0.05,
  noise: 0.6,
  tx: false,
};
const tuned: RadioKey = {
  at: "p0003",
  state: "tuning",
  frequency: "14.125",
  signal: 0.05,
  noise: 0.6,
  tx: false,
  tuning: true,
};
const cue: InstrumentCue = {
  id: "instrument_001",
  kind: "radio",
  at: "p0002",
  until: "p0004",
  placement: "top_right",
  keys: [listening, tuned],
};

function panel(
  key: InstrumentKey,
  previous: InstrumentKey | null,
  stepped: boolean,
  reducedMotion = false,
  span: InstrumentCue = cue,
  progress: number | null = null,
  hidden = false,
) {
  const reading = { cue: span, key, previous, progress } as InstrumentReading;
  return (
    <Instrument
      reading={reading}
      stepped={stepped}
      layout="nvl"
      reducedMotion={reducedMotion}
      reactive={false}
      dimmed={false}
      hidden={hidden}
      viewportRef={{ current: null }}
    />
  );
}

function digits(): string | null | undefined {
  return document.querySelector(".instrument__digits")?.textContent;
}

describe("Instrument", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    // jsdom has no canvas; the trace simply is not drawn.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rolls the digits through the band on a tuning page turn", () => {
    const view = render(panel(listening, null, false));
    expect(digits()).toBe("14.195");

    view.rerender(panel(tuned, listening, true));
    const seen = new Set<string>();
    for (let frame = 0; frame < 50; frame += 1) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
      seen.add(digits() ?? "");
    }
    expect(digits()).toBe("14.125");
    // Values strictly between the two frequencies were shown on the way.
    expect([...seen].some((value) => Number(value) < 14.195 && Number(value) > 14.125)).toBe(true);
  });

  it("lands on the new frequency at once after a jump", () => {
    const view = render(panel(listening, null, false));
    view.rerender(panel(tuned, listening, false));
    expect(digits()).toBe("14.125");
  });

  it("shows dashes where the text gives no frequency, and lights TX", () => {
    const silent: RadioKey = { ...listening, frequency: undefined, tx: true };
    render(panel(silent, null, false));
    expect(digits()).toBe("--.---");
    expect(document.querySelector(".instrument__lamp")?.classList.contains("is-lit")).toBe(true);
  });

  it("does not roll with reduced motion", () => {
    const view = render(panel(listening, null, false, true));
    view.rerender(panel(tuned, listening, true, true));
    expect(digits()).toBe("14.125");
  });
});

const breeze: WindKey = { at: "p0002", state: "breeze", strength: 0.25, gust: 0.3 };
const southWest: WindKey = { at: "p0003", state: "gale", from: "sw", strength: 0.75, gust: 0.6 };
const southEast: WindKey = { at: "p0004", state: "gale", from: "se", strength: 0.75, gust: 0.6 };
const windCue: InstrumentCue = {
  id: "instrument_001",
  kind: "wind",
  at: "p0002",
  until: "p0004",
  placement: "top_right",
  keys: [breeze, southWest, southEast],
};

function wind(key: WindKey, previous: WindKey | null, stepped: boolean, reducedMotion = false) {
  return panel(key, previous, stepped, reducedMotion, windCue);
}

function vaneAngle(): number {
  const transform = document.querySelector(".instrument__vane")?.getAttribute("transform") ?? "";
  return Number(/rotate\(([-\d.]+)/.exec(transform)?.[1]);
}

function litBars(): number[] {
  return [...document.querySelectorAll<SVGRectElement>(".instrument__bar")].map((bar) =>
    Number(bar.style.getPropertyValue("--lit")),
  );
}

describe("Instrument: wind", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws no arrow when the text names no direction", () => {
    render(wind(breeze, null, false));
    expect(document.querySelector(".instrument__vane")?.classList.contains("is-shown")).toBe(false);
    expect(litBars().filter((lit) => lit > 0).length).toBe(2);
  });

  it("points a south-west wind toward the north-east", () => {
    render(wind(southWest, breeze, false));
    expect(document.querySelector(".instrument__vane")?.classList.contains("is-shown")).toBe(true);
    expect(((vaneAngle() % 360) + 360) % 360).toBeCloseTo(45);
  });

  it("swings the short way round on a page turn when the wind backs", () => {
    const view = render(wind(southWest, breeze, false));
    view.rerender(wind(southEast, southWest, true));
    const seen: number[] = [];
    for (let frame = 0; frame < 120; frame += 1) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
      seen.push(vaneAngle());
    }
    // From 45° to -45° through north, never the long way through south.
    expect(Math.min(...seen)).toBeLessThan(0);
    expect(Math.max(...seen)).toBeLessThan(90);
    expect(seen.at(-1)).toBeCloseTo(-45, 0);
  });

  it("lands on the new direction at once after a jump or with reduced motion", () => {
    const view = render(wind(southWest, breeze, false));
    view.rerender(wind(southEast, southWest, false));
    expect(vaneAngle()).toBeCloseTo(-45);

    view.rerender(wind(southWest, southEast, true, true));
    expect(vaneAngle()).toBeCloseTo(45);
  });

  it("lights no bars and hides the arrow in calm air", () => {
    render(wind({ at: "p0002", state: "calm", strength: 0, gust: 0 }, null, false));
    expect(litBars().every((lit) => lit === 0)).toBe(true);
    expect(document.querySelector(".instrument")?.classList.contains("is-calm")).toBe(true);
  });
});

const sealed: LetterKey = { at: "p0002", state: "sealed" };
const reading: LetterKey = { at: "p0003", state: "reading" };
const faltering: LetterKey = { at: "p0004", state: "faltering" };
const letterCue: InstrumentCue = {
  id: "instrument_001",
  kind: "letter",
  at: "p0002",
  until: "p0006",
  placement: "top_right",
  keys: [sealed, reading, faltering],
};

function letter(key: LetterKey, turned: number, stepped: boolean, reducedMotion = false, hidden = false) {
  return panel(key, null, stepped, reducedMotion, letterCue, turned, hidden);
}

function sheetsOnLeft(): number {
  return Number(document.querySelector<HTMLCanvasElement>(".instrument__letter")?.dataset.turned);
}

function frames(count: number, each = 16): number[] {
  const seen: number[] = [];
  for (let frame = 0; frame < count; frame += 1) {
    act(() => {
      vi.advanceTimersByTime(each);
    });
    seen.push(sheetsOnLeft());
  }
  return seen;
}

describe("Instrument: letter", () => {
  let calls: string[];
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    calls = fakeCanvasContext().calls;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("turns a sheet over for every tenth of the letter, never showing a count", () => {
    expect(sheetsTurned(0)).toBe(0);
    expect(sheetsTurned(0.29)).toBe(2);
    expect(sheetsTurned(0.3)).toBe(3);
    expect(sheetsTurned(0.99)).toBe(9);
    expect(sheetsTurned(1)).toBe(10);
    render(letter(reading, 0.34, false));
    expect(sheetsOnLeft()).toBe(3);
    expect(document.querySelector(".instrument")?.textContent).toBe("");
  });

  it("moves sheets across one at a time on a page turn", () => {
    const view = render(letter(reading, 0.34, false));
    view.rerender(letter(reading, 0.56, true));
    expect(sheetsOnLeft()).toBe(3);
    const seen = frames(100);
    expect(seen).toContain(4);
    expect(seen.indexOf(4)).toBeLessThan(seen.indexOf(5));
    expect(seen.at(-1)).toBe(5);
  });

  it("moves them back when paging back", () => {
    const view = render(letter(reading, 0.56, false));
    view.rerender(letter(reading, 0.45, true));
    expect(frames(60).at(-1)).toBe(4);
  });

  it("lands with the piles already split after a jump or with reduced motion", () => {
    const view = render(letter(reading, 0.12, false));
    view.rerender(letter(reading, 0.71, false));
    expect(sheetsOnLeft()).toBe(7);

    view.rerender(letter(reading, 0.25, true, true));
    expect(sheetsOnLeft()).toBe(2);
  });

  it("draws the envelope, the faltering sheet, and the squared stack", () => {
    const view = render(letter(sealed, 0, false));
    frames(2);
    expect(calls).toContain("fillRect");

    view.rerender(letter(faltering, 0.5, true));
    calls.length = 0;
    frames(40);
    // Faltering ink keeps the face drawing: strokes and the spreading blot.
    expect(calls.filter((call) => call === "arc").length).toBeGreaterThan(0);

    view.rerender(letter({ at: "p0006", state: "set_down" }, 1, true));
    expect(document.querySelector(".instrument")?.classList.contains("is-set-down")).toBe(true);
  });

  it("stops drawing once nothing moves, and does not animate while hidden", () => {
    const view = render(letter(reading, 0.34, false));
    frames(3);
    calls.length = 0;
    frames(10);
    expect(calls).toEqual([]);

    const request = vi.spyOn(window, "requestAnimationFrame");
    view.rerender(letter(faltering, 0.34, true, false, true));
    expect(request).not.toHaveBeenCalled();
  });
});

const pianolaCue: InstrumentCue = {
  id: "instrument_002",
  kind: "pianola",
  at: "p0002",
  until: "p0006",
  placement: "top_right",
  keys: [{ at: "p0002", state: "closed" }],
};

function pianola(key: PianolaKey, stepped: boolean, reducedMotion = false, hidden = false) {
  return panel(key, null, stepped, reducedMotion, pianolaCue, null, hidden);
}

describe("Instrument: pianola", () => {
  let calls: string[];
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    calls = fakeCanvasContext().calls;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("punches the same roll for the same span and a different one for another", () => {
    const roll = punchRoll("instrument_002");
    expect(punchRoll("instrument_002")).toEqual(roll);
    expect(punchRoll("instrument_003")).not.toEqual(roll);
    const holes = roll.reduce((sum, hole) => sum + hole, 0);
    // Sparse enough to read as notes, dense enough to keep the keys busy.
    expect(holes / (PIANOLA_TRACKS * PIANOLA_ROWS)).toBeGreaterThan(0.08);
    expect(holes / (PIANOLA_TRACKS * PIANOLA_ROWS)).toBeLessThan(0.3);
    // The roll loops.
    for (let track = 0; track < PIANOLA_TRACKS; track += 1) {
      expect(holeAt(roll, track, PIANOLA_ROWS + 3)).toBe(holeAt(roll, track, 3));
      expect(holeAt(roll, track, -1)).toBe(holeAt(roll, track, PIANOLA_ROWS - 1));
    }
  });

  it("keeps the roll moving while it plays", () => {
    render(pianola({ at: "p0003", state: "playing", tempo: 0.7 }, false));
    const request = vi.spyOn(window, "requestAnimationFrame");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(request.mock.calls.length).toBeGreaterThan(20);
    expect(document.querySelector(".instrument__pianola")).not.toBeNull();
  });

  it("stands still when closed or dismantled", () => {
    const view = render(pianola({ at: "p0002", state: "closed" }, false));
    expect(document.querySelector(".instrument")?.classList.contains("is-closed")).toBe(true);
    const request = vi.spyOn(window, "requestAnimationFrame");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(request).not.toHaveBeenCalled();

    calls.length = 0;
    view.rerender(pianola({ at: "p0005", state: "dismantled" }, false));
    expect(calls).toContain("bezierCurveTo");
    expect(document.querySelector(".instrument")?.classList.contains("is-dismantled")).toBe(true);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("lifts the lid over a page turn, then settles", () => {
    const view = render(pianola({ at: "p0002", state: "closed" }, false));
    view.rerender(pianola({ at: "p0003", state: "faltering" }, true));
    const request = vi.spyOn(window, "requestAnimationFrame");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(request.mock.calls.length).toBeGreaterThan(30);

    // Closing again on a turn animates the lid down and the roll to a stop, then rests.
    view.rerender(pianola({ at: "p0004", state: "closed" }, true));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    request.mockClear();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("does not animate with reduced motion or while hidden", () => {
    const request = vi.spyOn(window, "requestAnimationFrame");
    const view = render(pianola({ at: "p0003", state: "playing" }, false, true));
    view.rerender(pianola({ at: "p0003", state: "playing" }, false, false, true));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(request).not.toHaveBeenCalled();
    expect(calls).toContain("fillRect");
  });
});
