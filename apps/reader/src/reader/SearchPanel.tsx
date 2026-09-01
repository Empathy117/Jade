import { useEffect, useMemo, useRef, useState } from "react";

import { searchExcerpt, searchReadParagraphs } from "./search";
import type { Paragraph } from "./types";

interface SearchPanelProps {
  paragraphs: Paragraph[];
  firstIndex: number;
  furthestReadIndex: number;
  onClose: () => void;
  onJump: (index: number) => void;
}

/**
 * Full-text search over everything already read.
 *
 * Anti-spoiler by construction: the index stops at the furthest-read
 * paragraph, the same boundary the history and the dossier honour.
 */
export function SearchPanel({
  paragraphs,
  firstIndex,
  furthestReadIndex,
  onClose,
  onJump,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  const result = useMemo(
    () => searchReadParagraphs(paragraphs, query, firstIndex, furthestReadIndex),
    [firstIndex, furthestReadIndex, paragraphs, query],
  );
  const trimmed = query.trim();

  return (
    <div
      className="history-backdrop"
      data-interactive="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="history-panel search-panel"
        role="dialog"
        aria-modal="true"
        aria-label="检索"
      >
        <header className="history-heading">
          <div>
            <p>检索</p>
            <span>只查已读过的正文 · 不会剧透后文</span>
          </div>
          <button type="button" aria-label="关闭检索" onClick={onClose}>×</button>
        </header>

        <div className="search-body">
          <div className="search-input-row">
            <input
              ref={inputRef}
              className="search-input"
              type="search"
              value={query}
              placeholder="输入词句，如人名、事物、说过的话…"
              aria-label="检索已读正文"
              onChange={(event) => setQuery(event.target.value)}
            />
            {trimmed ? (
              <span className="search-count" aria-live="polite">
                {result.total > 0 ? `${result.total} 段` : "无结果"}
              </span>
            ) : null}
          </div>

          <div className="history-list search-results">
            {result.matches.map((match) => {
              const excerpt = searchExcerpt(match);
              return (
                <button
                  className="history-entry search-hit"
                  type="button"
                  key={match.paragraphId}
                  onClick={() => onJump(match.index)}
                >
                  <span className="history-entry__number">
                    {String(match.index - firstIndex + 1).padStart(3, "0")}
                  </span>
                  <span className="history-entry__text">
                    {excerpt.prefix}
                    <mark>{excerpt.match}</mark>
                    {excerpt.suffix}
                  </span>
                  {match.occurrences > 1 ? (
                    <span className="history-entry__latest">×{match.occurrences}</span>
                  ) : null}
                </button>
              );
            })}
            {trimmed && result.total === 0 ? (
              <p className="panel-empty">已读内容里没有「{trimmed}」。也许它还在后文等你。</p>
            ) : null}
            {result.total > result.matches.length ? (
              <p className="panel-empty">
                另有 {result.total - result.matches.length} 段未列出，请换更具体的词。
              </p>
            ) : null}
          </div>
        </div>

        <footer className="history-footer">
          <span>点击结果跳转 · 按 Esc 关闭</span>
        </footer>
      </aside>
    </div>
  );
}
