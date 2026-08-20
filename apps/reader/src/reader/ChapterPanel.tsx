import { useEffect, useRef } from "react";

import { currentChapterIndex, type ChapterEntry } from "./chapters";

interface ChapterPanelProps {
  chapters: ChapterEntry[];
  currentIndex: number;
  onClose: () => void;
  onJump: (index: number) => void;
}

export function ChapterPanel({
  chapters,
  currentIndex,
  onClose,
  onJump,
}: ChapterPanelProps) {
  const currentItemRef = useRef<HTMLButtonElement | null>(null);
  const activeChapter = currentChapterIndex(chapters, currentIndex);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      currentItemRef.current?.focus({ preventScroll: true });
      currentItemRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

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
        aria-label="章节目录"
      >
        <header className="history-heading">
          <div>
            <p>章节目录</p>
            <span>已解锁 {chapters.length} 章 · 点击章节跳转</span>
          </div>
          <button type="button" aria-label="关闭章节目录" onClick={onClose}>×</button>
        </header>

        <div className="history-list">
          {chapters.map((chapter, offset) => {
            const isCurrent = chapter.index === activeChapter;
            return (
              <button
                className={`history-entry chapter-entry${isCurrent ? " is-current" : ""}`}
                type="button"
                key={chapter.index}
                ref={isCurrent ? currentItemRef : undefined}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => onJump(chapter.index)}
              >
                <span className="history-entry__number">
                  {String(offset + 1).padStart(2, "0")}
                </span>
                <span className="history-entry__text">{chapter.text}</span>
                {isCurrent ? <span className="history-entry__latest">在读</span> : null}
              </button>
            );
          })}
        </div>

        <footer className="history-footer">
          <span>按 Esc 关闭</span>
        </footer>
      </aside>
    </div>
  );
}
