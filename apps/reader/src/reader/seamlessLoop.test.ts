import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Howl } from "howler";

import { SeamlessLoop } from "./seamlessLoop";

/** Just enough of a Howl to watch which voices start and how they fade. */
function fakeHowl(duration: number) {
  let nextId = 1;
  const volumes = new Map<number, number>();
  const fades: { id: number; from: number; to: number; ms: number }[] = [];
  const howl = {
    state: () => "loaded",
    duration: () => duration,
    play: vi.fn(() => {
      const id = nextId++;
      volumes.set(id, 0);
      return id;
    }),
    // Like Howler: a single argument naming a voice reads that voice's volume.
    volume: vi.fn((value: number, id?: number) => {
      if (id === undefined && volumes.has(value)) return volumes.get(value);
      volumes.set(id!, value);
      return howl;
    }),
    fade: vi.fn((from: number, to: number, ms: number, id: number) => {
      fades.push({ id, from, to, ms });
      volumes.set(id, to);
      return howl;
    }),
    loop: vi.fn(),
    once: vi.fn(),
    stop: vi.fn(),
    unload: vi.fn(),
  };
  return { howl: howl as unknown as Howl, raw: howl, fades };
}

describe("SeamlessLoop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts the next pass before the current one ends and crossfades", () => {
    const { howl, raw, fades } = fakeHowl(12);
    const loop = new SeamlessLoop(howl);
    loop.start(0.2, 900);
    expect(raw.play).toHaveBeenCalledTimes(1);

    // 15 % of 12 s is 1.8 s of overlap, so the next pass starts at 10.2 s.
    vi.advanceTimersByTime(10_199);
    expect(raw.play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(raw.play).toHaveBeenCalledTimes(2);
    // Staggered ramps of 70 % of the overlap: in at once, out 540 ms later.
    expect(fades).toContainEqual({ id: 2, from: 0, to: 0.2, ms: 1260 });
    expect(fades).not.toContainEqual(expect.objectContaining({ id: 1, to: 0 }));
    vi.advanceTimersByTime(540);
    expect(fades).toContainEqual({ id: 1, from: 0.2, to: 0, ms: 1260 });

    // And keeps going, pass after pass.
    vi.advanceTimersByTime(10_200 - 540);
    expect(raw.play).toHaveBeenCalledTimes(3);
    loop.unload();
  });

  it("carries a volume change into the next pass", () => {
    const { howl, fades } = fakeHowl(12);
    const loop = new SeamlessLoop(howl);
    loop.start(0.2, 900);
    loop.setVolume(0.05, 250);
    vi.advanceTimersByTime(10_200);
    expect(fades).toContainEqual({ id: 2, from: 0, to: 0.05, ms: 1260 });
    loop.unload();
  });

  it("stops scheduling once stopped", () => {
    const { howl, raw } = fakeHowl(12);
    const loop = new SeamlessLoop(howl);
    loop.start(0.2, 900);
    loop.stop(900, () => undefined);
    vi.advanceTimersByTime(30_000);
    expect(raw.play).toHaveBeenCalledTimes(1);
    expect(raw.unload).toHaveBeenCalled();
  });

  it("fades a pass still waiting to hand over when stopped mid-seam", () => {
    const { howl, fades } = fakeHowl(12);
    const loop = new SeamlessLoop(howl);
    loop.start(0.2, 900);
    vi.advanceTimersByTime(10_200);
    loop.stop(900, () => undefined);
    expect(fades).toContainEqual({ id: 1, from: 0.2, to: 0, ms: 900 });
    expect(fades).toContainEqual({ id: 2, from: 0.2, to: 0, ms: 900 });
  });

  it("plays a non-looping track once", () => {
    const { howl, raw } = fakeHowl(12);
    new SeamlessLoop(howl).start(0.2, 900, false);
    vi.advanceTimersByTime(30_000);
    expect(raw.play).toHaveBeenCalledTimes(1);
  });
});
