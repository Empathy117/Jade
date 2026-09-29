import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Instrument } from "./Instrument";
import type { InstrumentReading } from "./staging";
import type { InstrumentCue, InstrumentKey } from "./types";

const listening: InstrumentKey = {
  at: "p0002",
  state: "listening",
  frequency: "14.195",
  signal: 0.05,
  noise: 0.6,
  tx: false,
};
const tuned: InstrumentKey = {
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

function panel(key: InstrumentKey, previous: InstrumentKey | null, stepped: boolean, reducedMotion = false) {
  const reading: InstrumentReading = { cue, key, previous };
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
    const silent: InstrumentKey = { ...listening, frequency: undefined, tx: true };
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
