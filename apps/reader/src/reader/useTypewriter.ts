import { useCallback, useEffect, useRef } from "react";

const HIGHLIGHT = "untyped";

interface HighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

function highlightRegistry(): HighlightRegistry | null {
  const css = globalThis.CSS as unknown as { highlights?: HighlightRegistry } | undefined;
  const Highlight = (globalThis as { Highlight?: unknown }).Highlight;
  return css?.highlights && typeof Highlight === "function" ? css.highlights : null;
}

/** The line's own text nodes, leaving out note markers and chips. */
function textNodes(root: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("button") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  return nodes;
}

/**
 * Type the current line out progressively.
 *
 * The text is fully in the DOM from the first frame — selection, notes, and
 * screen readers see it all. Only a CSS highlight over the untyped tail hides
 * it visually, so nothing about the source text or its offsets changes.
 * Browsers without the Highlight API simply show the line at once.
 */
export function useTypewriter(
  lineRef: React.RefObject<HTMLElement | null>,
  lineKey: string,
  enabled: boolean,
  charsPerSecond: number,
): () => boolean {
  const typing = useRef<{ finish: () => void } | null>(null);

  useEffect(() => {
    const registry = highlightRegistry();
    const line = lineRef.current?.querySelector(".paragraph");
    if (!enabled || !registry || !line) return;

    const nodes = textNodes(line);
    const total = nodes.reduce((sum, node) => sum + node.length, 0);
    if (total === 0) return;

    const Highlight = (globalThis as unknown as { Highlight: new (...ranges: Range[]) => unknown })
      .Highlight;
    const hideFrom = (shown: number) => {
      let remaining = shown;
      for (const node of nodes) {
        if (remaining <= node.length) {
          const range = document.createRange();
          range.setStart(node, remaining);
          const last = nodes[nodes.length - 1];
          range.setEnd(last, last.length);
          registry.set(HIGHLIGHT, new Highlight(range));
          return;
        }
        remaining -= node.length;
      }
    };

    let frame = 0;
    // Timed from the first frame: a frame's timestamp can predate this effect.
    let started: number | null = null;
    const finish = () => {
      window.cancelAnimationFrame(frame);
      registry.delete(HIGHLIGHT);
      typing.current = null;
    };
    const tick = (now: number) => {
      started ??= now;
      const shown = Math.max(0, Math.floor(((now - started) / 1000) * charsPerSecond));
      if (shown >= total) {
        finish();
        return;
      }
      hideFrom(shown);
      frame = window.requestAnimationFrame(tick);
    };
    hideFrom(0);
    typing.current = { finish };
    frame = window.requestAnimationFrame(tick);
    return finish;
  }, [charsPerSecond, enabled, lineKey, lineRef]);

  /** Show the whole line now. Returns true if a line was still being typed. */
  return useCallback(() => {
    if (!typing.current) return false;
    typing.current.finish();
    return true;
  }, []);
}
