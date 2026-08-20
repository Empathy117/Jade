import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Howler reaches for a real AudioContext, which jsdom does not provide. The
// Director's audio behaviour is covered by audioPolicy; here it only needs to
// stay out of the way of the reading flow.
vi.mock("howler", () => {
  class Howl {
    play() {}
    fade() {}
    stop() {}
    unload() {}
    volume() {
      return 0;
    }
  }
  return {
    Howl,
    Howler: { ctx: null, volume() {}, mute() {} },
  };
});

// jsdom implements neither of these, and the Reader uses both for scrolling.
beforeEach(() => {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
  Element.prototype.scrollBy = function scrollBy() {};
  // eslint-disable-next-line @typescript-eslint/unbound-method -- presence check, not a call
  const hasMatchMedia = Boolean(window.matchMedia);
  if (hasMatchMedia) return;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
