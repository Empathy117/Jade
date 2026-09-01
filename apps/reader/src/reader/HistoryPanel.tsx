import { useEffect, useRef, useState } from "react";

import {
  expandHistoryWindow,
  historyWindowAround,
  type HistoryWindow,
} from "./historyWindow";
import { normalizeMarkerBreaks } from "./notes";
import type { Paragraph } from "./types";

interface HistoryPanelProps {
  paragraphs: Paragraph[];
  firstIndex: number;
  currentIndex: number;
  furthestReadIndex: number;
  onClose: () => void;
  onJump: (index: number) => void;
  onReturnToLatest: () => void;
}

export function HistoryPanel({
  paragraphs,
  firstIndex,
  currentIndex,
  furthestReadIndex,
  onClose,
  onJump,
  onReturnToLatest,
}: HistoryPanelProps) {
  const currentItemRef = useRef<HTMLButtonElement | null>(null);
  // The panel is mounted fresh each time it opens, so the window starts around
  // wherever the reader currently is.
  const [visibleWindow, setVisibleWindow] = useState<HistoryWindow>(() =>
    historyWindowAround(firstIndex, furthestReadIndex, currentIndex),
  );

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      currentItemRef.current?.focus({ preventScroll: true });
      // Always an instant jump: the panel should open already positioned, and
      // a smooth scroll silently does nothing over the distance a long book
      // puts between the top of the list and the reading position.
      currentItemRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  const readCount = Math.max(0, furthestReadIndex - firstIndex + 1);
  const visible = paragraphs.slice(visibleWindow.start, visibleWindow.end + 1);
  const hasEarlier = visibleWindow.start > firstIndex;
  const hasLater = visibleWindow.end < furthestReadIndex;

  function expand(edge: "earlier" | "later") {
    setVisibleWindow((current) =>
      expandHistoryWindow(current, edge, firstIndex, furthestReadIndex),
    );
  }

  return (
    <div
      className="history-backdrop"
      data-interactive="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="history-panel"
        role="dialog"
        aria-modal="true"
        aria-label="阅读历史"
      >
        <header className="history-heading">
          <div>
            <p>阅读历史</p>
            <span>已读 {readCount} 段 · 点击任意段落跳转</span>
          </div>
          <button type="button" aria-label="关闭阅读历史" onClick={onClose}>×</button>
        </header>

        <div className="history-list">
          {hasEarlier ? (
            <button
              className="history-more"
              type="button"
              onClick={() => expand("earlier")}
            >
              载入更早的段落（还有 {visibleWindow.start - firstIndex} 段）
            </button>
          ) : null}

          {visible.map((paragraph, offset) => {
            const position = visibleWindow.start + offset;
            // Apparatus paragraphs (notes, print navigation) never enter the
            // reading flow, so the history offers no way to land on them.
            if (paragraph.kind === "note" || paragraph.kind === "nav") return null;
            const isCurrent = position === currentIndex;
            const isLatest = position === furthestReadIndex;
            return (
              <button
                className={`history-entry${isCurrent ? " is-current" : ""}${isLatest ? " is-latest" : ""}`}
                type="button"
                key={paragraph.id}
                ref={isCurrent ? currentItemRef : undefined}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => onJump(position)}
              >
                <span className="history-entry__number">
                  {String(position - firstIndex + 1).padStart(3, "0")}
                </span>
                <span className="history-entry__text">
                  {normalizeMarkerBreaks(paragraph.text)}
                </span>
                {isLatest ? <span className="history-entry__latest">最新</span> : null}
              </button>
            );
          })}

          {hasLater ? (
            <button
              className="history-more"
              type="button"
              onClick={() => expand("later")}
            >
              载入更晚的段落（还有 {furthestReadIndex - visibleWindow.end} 段）
            </button>
          ) : null}
        </div>

        <footer className="history-footer">
          <span>按 ↑ 或 Esc 关闭</span>
          <button
            type="button"
            disabled={currentIndex === furthestReadIndex}
            onClick={onReturnToLatest}
          >
            回到最新进度 <span aria-hidden="true">→</span>
          </button>
        </footer>
      </aside>
    </div>
  );
}
