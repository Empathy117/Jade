import { vi } from "vitest";

/**
 * A stand-in 2D context for jsdom, which has no canvas: every method is a
 * no-op that records its name, and every property can be set, so a face's
 * drawing code runs end to end.
 */
export function fakeCanvasContext(): { calls: string[] } {
  const calls: string[] = [];
  const handler: ProxyHandler<Record<string | symbol, unknown>> = {
    get(target, property) {
      if (property in target) return target[property];
      return (...args: unknown[]) => {
        calls.push(String(property));
        void args;
        return new Proxy({}, handler);
      };
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  };
  const context = new Proxy({ globalAlpha: 1 }, handler);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return { calls };
}
