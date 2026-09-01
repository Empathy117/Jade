import { useEffect, useMemo, useRef, useState } from "react";

import type { Annotation } from "./annotations";
import type { Bookmark } from "./bookmarks";
import { currentChapterIndex, type ChapterEntry } from "./chapters";
import { normalizeMarkerBreaks } from "./notes";
import type { ParagraphPositions } from "./readerState";
import type { Paragraph } from "./types";

export type ContentsTab = "chapters" | "bookmarks" | "annotations";

interface ContentsPanelProps {
  chapters: ChapterEntry[];
  bookmarks: Bookmark[];
  annotations: Annotation[];
  paragraphs: Paragraph[];
  positions: ParagraphPositions;
  currentIndex: number;
  initialTab: ContentsTab | null;
  onClose: () => void;
  onJump: (index: number) => void;
  onRemoveBookmark: (paragraphId: string) => void;
  onRemoveAnnotation: (paragraphId: string) => void;
}

/**
 * The reader's own way back into the book: unlocked chapters, bookmarks, and
 * margin notes, all jumpable. Like everything else, nothing here reaches past
 * what has already been read.
 */
export function ContentsPanel({
  chapters,
  bookmarks,
  annotations,
  paragraphs,
  positions,
  currentIndex,
  initialTab,
  onClose,
  onJump,
  onRemoveBookmark,
  onRemoveAnnotation,
}: ContentsPanelProps) {
  const hasChapters = chapters.length > 0;
  const [tab, setTab] = useState<ContentsTab>(() => {
    if (initialTab && (initialTab !== "chapters" || hasChapters)) return initialTab;
    return hasChapters ? "chapters" : "bookmarks";
  });
  const currentItemRef = useRef<HTMLButtonElement | null>(null);
  const activeChapter = currentChapterIndex(chapters, currentIndex);

  useEffect(() => {
    if (tab !== "chapters") return;
    const animationFrame = window.requestAnimationFrame(() => {
      currentItemRef.current?.focus({ preventScroll: true });
      currentItemRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [tab]);

  const bookmarkRows = useMemo(
    () => resolveRows(bookmarks, positions, paragraphs, (entry) => entry.createdAt),
    [bookmarks, paragraphs, positions],
  );
  const annotationRows = useMemo(
    () => resolveRows(annotations, positions, paragraphs, (entry) => entry.updatedAt),
    [annotations, paragraphs, positions],
  );

  const tabs: Array<{ id: ContentsTab; label: string; count: number }> = [
    ...(hasChapters
      ? [{ id: "chapters" as const, label: "章节", count: chapters.length }]
      : []),
    { id: "bookmarks", label: "书签", count: bookmarkRows.length },
    { id: "annotations", label: "批注", count: annotationRows.length },
  ];

  return (
    <div
      className="history-backdrop"
      data-interactive="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="history-panel contents-panel"
        role="dialog"
        aria-modal="true"
        aria-label="目录"
      >
        <header className="history-heading">
          <div>
            <p>目录</p>
            <span>章节、书签与批注 · 点击任意条目跳转</span>
          </div>
          <button type="button" aria-label="关闭目录" onClick={onClose}>×</button>
        </header>

        <nav className="codex-tabs" role="tablist" aria-label="目录页签">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === tab}
              className={entry.id === tab ? "is-current" : ""}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
              {entry.count > 0 ? <small>{entry.count}</small> : null}
            </button>
          ))}
        </nav>

        <div className="history-list">
          {tab === "chapters"
            ? chapters.map((chapter, offset) => {
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
              })
            : null}

          {tab === "bookmarks" ? (
            bookmarkRows.length > 0 ? (
              bookmarkRows.map((row) => (
                <div className="history-entry contents-row" key={row.id}>
                  <button
                    className="contents-row__jump"
                    type="button"
                    onClick={() => onJump(row.index)}
                  >
                    <span className="history-entry__number">
                      {formatDay(row.timestamp)}
                    </span>
                    <span className="history-entry__text">{row.excerpt}</span>
                  </button>
                  <button
                    className="contents-row__remove"
                    type="button"
                    aria-label="删除这条书签"
                    title="删除书签"
                    onClick={() => onRemoveBookmark(row.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <p className="panel-empty">
                还没有书签。阅读时点右上角的「签」，或按 B 键，收藏当前位置。
              </p>
            )
          ) : null}

          {tab === "annotations" ? (
            annotationRows.length > 0 ? (
              annotationRows.map((row) => (
                <div className="history-entry contents-row" key={row.id}>
                  <button
                    className="contents-row__jump"
                    type="button"
                    onClick={() => onJump(row.index)}
                  >
                    <span className="history-entry__number">
                      {formatDay(row.timestamp)}
                    </span>
                    <span className="contents-row__stack">
                      <span className="history-entry__text">{row.note}</span>
                      <span className="contents-row__source">{row.excerpt}</span>
                    </span>
                  </button>
                  <button
                    className="contents-row__remove"
                    type="button"
                    aria-label="删除这条批注"
                    title="删除批注"
                    onClick={() => onRemoveAnnotation(row.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <p className="panel-empty">
                还没有批注。点击当前段落末尾淡淡的「批」，写下此刻的想法。
              </p>
            )
          ) : null}
        </div>

        <footer className="history-footer">
          <span>按 Esc 关闭</span>
        </footer>
      </aside>
    </div>
  );
}

interface ContentsRow {
  id: string;
  index: number;
  excerpt: string;
  note: string;
  timestamp: number;
}

function resolveRows<T extends { id: string; text?: string }>(
  entries: T[],
  positions: ParagraphPositions,
  paragraphs: Paragraph[],
  timestampOf: (entry: T) => number,
): ContentsRow[] {
  const rows: ContentsRow[] = [];
  for (const entry of entries) {
    const index = positions.get(entry.id);
    if (index === undefined) continue;
    rows.push({
      id: entry.id,
      index,
      excerpt: excerptOf(paragraphs[index]),
      note: entry.text ?? "",
      timestamp: timestampOf(entry),
    });
  }
  rows.sort((a, b) => a.index - b.index);
  return rows;
}

function excerptOf(paragraph: Paragraph): string {
  const text = normalizeMarkerBreaks(paragraph.text).replace(/\n/g, " ");
  return text.length > 52 ? `${text.slice(0, 52)}…` : text;
}

function formatDay(timestamp: number): string {
  const day = new Date(timestamp);
  return `${day.getMonth() + 1}·${day.getDate()}`;
}
