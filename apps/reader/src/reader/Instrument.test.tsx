import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Instrument } from "./Instrument";
import type { InstrumentReading } from "./staging";
import type { InstrumentCue, RadioKey, WindKey } from "./types";

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
  key: RadioKey | WindKey,
  previous: RadioKey | WindKey | null,
  stepped: boolean,
  reducedMotion = false,
  span: InstrumentCue = cue,
) {
  const reading = { cue: span, key, previous } as InstrumentReading;
  return (
    <Instrument
      reading={reading}
      stepped={stepped}
      layout="nvl"
      reducedMotion={reducedMotion}
      reactive={false}
      dimmed={false}
      hidden={false}
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
