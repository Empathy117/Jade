import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LibraryScreen } from "./LibraryScreen";
import { BackgroundStage } from "./reader/BackgroundStage";
import {
  assetUrl,
  findLibraryBook,
  indexAssets,
  loadBookBundle,
  loadLibrary,
  sourceIllustrationUrl,
} from "./reader/data";
import {
  ReferenceGallery,
  resolveGuideReferences,
} from "./reader/ReferenceGallery";
import {
  firstReadableIndex,
  moveReadingCursor,
  paragraphIndex,
  preferredStartIndex,
  progressIndex,
  progressStorageKey,
  resolvePlaybackAt,
  sceneAt,
  visibleStartIndex,
} from "./reader/readerState";
import type { ReadingCursor } from "./reader/readerState";
import { keepParagraphAboveBottomFade } from "./reader/readingScroll";
import type {
  BookBundle,
  BookProductionMode,
  LibraryBook,
  LibraryDocument,
  Paragraph,
} from "./reader/types";
import {
  type AudioSettings,
  unlockAudio,
  useAudioDirector,
} from "./reader/useAudioDirector";

interface ReaderSettings extends AudioSettings {
  fontScale: number;
  reducedMotion: boolean;
}

const SETTINGS_KEY = "immersive-reader:settings:v1";

export function App() {
  const [library, setLibrary] = useState<LibraryDocument | null>(null);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [bundle, setBundle] = useState<BookBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [cursor, setCursor] = useState<ReadingCursor>({
    currentIndex: 1,
    furthestReadIndex: 1,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [readingFloorIndex, setReadingFloorIndex] = useState(1);
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const readingViewportRef = useRef<HTMLElement | null>(null);
  const latestParagraphRef = useRef<HTMLDivElement | null>(null);
  const currentHistoryItemRef = useRef<HTMLButtonElement | null>(null);
  const { currentIndex, furthestReadIndex } = cursor;

  useEffect(() => {
    let cancelled = false;
    loadLibrary()
      .then((loadedLibrary) => {
        if (cancelled) return;
        setLibrary(loadedLibrary);
        setSelectedBook(
          findLibraryBook(loadedLibrary, requestedBookFromUrl()),
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!library) return;
    const syncSelectionFromHistory = () => {
      setStarted(false);
      setSelectedBook(findLibraryBook(library, requestedBookFromUrl()));
    };
    window.addEventListener("popstate", syncSelectionFromHistory);
    return () => window.removeEventListener("popstate", syncSelectionFromHistory);
  }, [library]);

  useEffect(() => {
    let cancelled = false;
    setStarted(false);
    setSettingsOpen(false);
    setHistoryOpen(false);
    setReferencesOpen(false);
    setSelectedReferenceId(null);
    setBundle(null);
    setLoadError(null);
    if (!selectedBook) return () => { cancelled = true; };

    loadBookBundle(selectedBook)
      .then((loaded) => {
        if (cancelled) return;
        const savedId = safeGet(progressStorageKey(loaded.source));
        const sourceStart = firstReadableIndex(loaded.source);
        const preferredStart = preferredStartIndex(loaded.source, loaded.guide);
        const savedIndex = savedId
          ? progressIndex(loaded.source, savedId)
          : preferredStart;
        setBundle(loaded);
        setHasSavedProgress(Boolean(savedId));
        setReadingFloorIndex(savedIndex < preferredStart ? sourceStart : preferredStart);
        setCursor({
          currentIndex: savedIndex,
          furthestReadIndex: savedIndex,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => { cancelled = true; };
  }, [selectedBook]);

  useEffect(() => safeSet(SETTINGS_KEY, JSON.stringify(settings)), [settings]);

  useEffect(() => {
    document.title = selectedBook
      ? `${selectedBook.title} · Jade Reader`
      : "Jade Reader · 私人沉浸书库";
  }, [selectedBook]);

  const assets = useMemo(
    () => (bundle ? indexAssets(bundle.assets) : new Map()),
    [bundle],
  );
  const sourcePositions = useMemo(
    () => (bundle ? paragraphIndex(bundle.source) : new Map<string, number>()),
    [bundle],
  );
  const referenceItems = useMemo(
    () =>
      bundle && selectedBook
        ? resolveGuideReferences(bundle.source, bundle.guide, selectedBook.path)
        : [],
    [bundle, selectedBook],
  );
  const availableReferences = useMemo(
    () =>
      referenceItems.filter(
        (item) => (sourcePositions.get(item.illustration.at) ?? Number.POSITIVE_INFINITY) <= furthestReadIndex,
      ),
    [furthestReadIndex, referenceItems, sourcePositions],
  );
  const illustrationsByAnchor = useMemo(() => {
    const grouped = new Map<string, NonNullable<BookBundle["source"]["illustrations"]>>();
    for (const illustration of bundle?.source.illustrations ?? []) {
      const anchored = grouped.get(illustration.at) ?? [];
      anchored.push(illustration);
      grouped.set(illustration.at, anchored);
    }
    return grouped;
  }, [bundle]);
  const playbackState = useMemo(
    () =>
      bundle
        ? resolvePlaybackAt(bundle.source, bundle.playback, currentIndex)
        : { background: null, music: null, ambience: [], sceneId: null, cue: null },
    [bundle, currentIndex],
  );
  const audioError = useAudioDirector({
    started,
    bookPath: selectedBook?.path ?? null,
    playback: playbackState,
    assets,
    settings,
  });

  const activeScene = useMemo(
    () => (bundle ? sceneAt(bundle.source, bundle.direction, currentIndex) : null),
    [bundle, currentIndex],
  );
  const sourceFirstIndex = bundle ? firstReadableIndex(bundle.source) : 1;
  const preferredIndex = bundle ? preferredStartIndex(bundle.source, bundle.guide) : 1;
  const firstIndex = bundle ? readingFloorIndex : 1;
  const lastIndex = bundle ? bundle.source.paragraphs.length - 1 : 1;
  const visibleStart = bundle
    ? visibleStartIndex(bundle.source, bundle.playback, currentIndex, firstIndex)
    : firstIndex;
  const visibleParagraphs = bundle
    ? bundle.source.paragraphs.slice(visibleStart, currentIndex + 1)
    : [];
  const historyParagraphs = bundle
    ? bundle.source.paragraphs.slice(firstIndex, furthestReadIndex + 1)
    : [];
  const bodyLength = bundle ? bundle.source.paragraphs.length - preferredIndex : 1;
  const bodyPosition = Math.max(0, furthestReadIndex - preferredIndex + 1);
  const progress = Math.min(100, (bodyPosition / bodyLength) * 100);
  const sceneNumber = bundle && activeScene
    ? bundle.direction.scenes.findIndex((scene) => scene.id === activeScene.id) + 1
    : 1;
  const backgroundAsset = playbackState.background
    ? assets.get(playbackState.background.asset_id)
    : undefined;
  const backgroundSrc = backgroundAsset && selectedBook
    ? assetUrl(selectedBook.path, backgroundAsset)
    : null;
  const musicAsset = playbackState.music
    ? assets.get(playbackState.music.asset_id)
    : undefined;
  const trackName = musicAsset?.title ?? musicAsset?.id ?? "无音乐";

  const next = useCallback(() => {
    if (!bundle || currentIndex >= bundle.source.paragraphs.length - 1) return;
    setCursor((current) =>
      moveReadingCursor(bundle.source, current, current.currentIndex + 1),
    );
  }, [bundle, currentIndex]);

  const previous = useCallback(() => {
    if (!bundle) return;
    setCursor((current) =>
      moveReadingCursor(
        bundle.source,
        current,
        Math.max(readingFloorIndex, current.currentIndex - 1),
      ),
    );
  }, [bundle, readingFloorIndex]);

  useEffect(() => {
    if (!started || !bundle) return;
    safeSet(
      progressStorageKey(bundle.source),
      bundle.source.paragraphs[furthestReadIndex].id,
    );
  }, [bundle, furthestReadIndex, started]);

  useEffect(() => {
    if (!started || !bundle || historyOpen) return;
    const animationFrame = window.requestAnimationFrame(() => {
      if (readingViewportRef.current && latestParagraphRef.current) {
        keepParagraphAboveBottomFade(
          readingViewportRef.current,
          latestParagraphRef.current,
          settings.reducedMotion,
        );
      }
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [bundle, currentIndex, historyOpen, settings.reducedMotion, started]);

  useEffect(() => {
    if (!historyOpen) return;
    const animationFrame = window.requestAnimationFrame(() => {
      currentHistoryItemRef.current?.focus({ preventScroll: true });
      currentHistoryItemRef.current?.scrollIntoView({
        behavior: settings.reducedMotion ? "auto" : "smooth",
        block: "center",
      });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [currentIndex, historyOpen, settings.reducedMotion]);

  useEffect(() => {
    if (!started) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isFormControl = target?.matches("input, select, textarea");
      if (event.key === "ArrowUp" && !isFormControl) {
        event.preventDefault();
        setSettingsOpen(false);
        setReferencesOpen(false);
        setHistoryOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setHistoryOpen(false);
        setReferencesOpen(false);
        return;
      }
      if (target?.matches("input, button, select, textarea")) return;
      if (historyOpen || referencesOpen) return;
      if (event.key === " " || event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyOpen, next, previous, referencesOpen, started]);

  function beginReading(mode: "resume" | "preferred" | "beginning") {
    if (!bundle) return;
    if (mode !== "resume") {
      const startIndex = mode === "preferred" ? preferredIndex : sourceFirstIndex;
      setCursor({
        currentIndex: startIndex,
        furthestReadIndex: startIndex,
      });
      setReadingFloorIndex(startIndex);
      safeRemove(progressStorageKey(bundle.source));
      setHasSavedProgress(false);
    }
    unlockAudio();
    setStarted(true);
  }

  function toggleHistory() {
    setSettingsOpen(false);
    setReferencesOpen(false);
    setHistoryOpen((open) => !open);
  }

  function toggleReferences() {
    setSettingsOpen(false);
    setHistoryOpen(false);
    setSelectedReferenceId((current) =>
      availableReferences.some((item) => item.reference.id === current)
        ? current
        : availableReferences[0]?.reference.id ?? null,
    );
    setReferencesOpen((open) => !open);
  }

  function openReferenceForIllustration(illustrationId: string) {
    const item = availableReferences.find(
      (reference) => reference.illustration.id === illustrationId,
    );
    if (!item) return;
    setSettingsOpen(false);
    setHistoryOpen(false);
    setSelectedReferenceId(item.reference.id);
    setReferencesOpen(true);
  }

  function jumpToReference(paragraphId: string) {
    if (!bundle) return;
    const targetIndex = sourcePositions.get(paragraphId);
    if (targetIndex === undefined) return;
    if (targetIndex < readingFloorIndex) setReadingFloorIndex(sourceFirstIndex);
    setCursor((current) => moveReadingCursor(bundle.source, current, targetIndex));
    setReferencesOpen(false);
  }

  function jumpToHistory(targetIndex: number) {
    if (!bundle) return;
    setCursor((current) => moveReadingCursor(bundle.source, current, targetIndex));
    setHistoryOpen(false);
  }

  function returnToLatest() {
    setCursor((current) => ({
      ...current,
      currentIndex: current.furthestReadIndex,
    }));
    setHistoryOpen(false);
  }

  function handleReaderClick(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-interactive='true']")) return;
    next();
  }

  function selectBook(book: LibraryBook) {
    updateBookUrl(book.path);
    setSelectedBook(book);
  }

  function returnToLibrary() {
    updateBookUrl(null);
    setStarted(false);
    setSelectedBook(null);
  }

  if (loadError) {
    return (
      <ErrorScreen
        message={loadError}
        onBack={library ? returnToLibrary : undefined}
      />
    );
  }

  if (!library) {
    return (
      <main className="loading-screen">
        <span className="loading-mark" aria-hidden="true" />
        <p>正在装订书页…</p>
      </main>
    );
  }

  if (!selectedBook) {
    return (
      <LibraryScreen
        books={library.books}
        hasProgress={(book) =>
          Boolean(
            safeGet(
              `immersive-reader:${book.book_id}:revision-${book.source_revision}`,
            ),
          )
        }
        onSelect={selectBook}
      />
    );
  }

  if (!bundle) {
    return (
      <main className="loading-screen">
        <span className="loading-mark" aria-hidden="true" />
        <p>正在装订《{selectedBook.title}》…</p>
      </main>
    );
  }

  return (
    <main
      className={`reader-app${started ? " is-reading" : " is-cover"}${settings.pureMode ? " is-pure" : ""}`}
      style={{ "--font-scale": settings.fontScale } as React.CSSProperties}
      onClick={started ? handleReaderClick : undefined}
    >
      <BackgroundStage
        src={backgroundSrc}
        durationMs={playbackState.background?.duration_ms ?? 1200}
        reducedMotion={settings.reducedMotion}
        hidden={settings.pureMode}
      />

      {!started ? (
        <CoverScreen
          title={bundle.source.title}
          production={selectedBook.production}
          hasProgress={hasSavedProgress}
          hasPreferredStart={preferredIndex > sourceFirstIndex}
          progress={progress}
          onContinue={() => beginReading("resume")}
          onStartPreferred={() => beginReading("preferred")}
          onStartBeginning={() => beginReading("beginning")}
          onLibrary={returnToLibrary}
        />
      ) : (
        <>
          <header className="reader-header" data-interactive="true">
            <button
              className="book-mark book-mark--button"
              type="button"
              data-interactive="true"
              aria-label="返回书库"
              title="返回书库"
              onClick={returnToLibrary}
            >
              <span className="book-mark__label">正在阅读</span>
              <span className="book-mark__title">{bundle.source.title}</span>
            </button>
            <div className="scene-mark" aria-live="polite">
              <span>第 {sceneNumber} 幕</span>
              <strong>{activeScene ? activeScene.label ?? activeScene.location : ""}</strong>
            </div>
            <div className="header-actions">
              {availableReferences.length > 0 ? (
                <button
                  className="icon-button icon-button--references"
                  type="button"
                  data-interactive="true"
                  aria-label="资料图册"
                  aria-expanded={referencesOpen}
                  title={`资料图册（已解锁 ${availableReferences.length} 张）`}
                  onClick={toggleReferences}
                >
                  <span aria-hidden="true">图</span>
                </button>
              ) : null}
              <button
                className="icon-button icon-button--history"
                type="button"
                data-interactive="true"
                aria-label="阅读历史"
                aria-expanded={historyOpen}
                title="阅读历史（↑）"
                onClick={toggleHistory}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                className="icon-button"
                type="button"
                data-interactive="true"
                aria-label="阅读设置"
                aria-expanded={settingsOpen}
                onClick={() => {
                  setHistoryOpen(false);
                  setReferencesOpen(false);
                  setSettingsOpen((open) => !open);
                }}
              >
                <span aria-hidden="true">Aa</span>
              </button>
            </div>
          </header>

          <div className="progress-rail" aria-hidden="true">
            <div className="progress-rail__fill" style={{ width: `${progress}%` }} />
          </div>

          <section
            className="reading-viewport"
            aria-label="小说正文"
            ref={readingViewportRef}
          >
            <div className="paragraph-stack" aria-live="polite">
              {visibleParagraphs.map((paragraph, index) => {
                const lines = paragraph.text.split("\n");
                const illustrations = illustrationsByAnchor.get(paragraph.id) ?? [];
                return (
                  <div
                    className="reading-block"
                    key={paragraph.id}
                    ref={index === visibleParagraphs.length - 1 ? latestParagraphRef : undefined}
                    data-paragraph-id={paragraph.id}
                  >
                    <div
                      className={`paragraph paragraph--${paragraph.kind}${index === visibleParagraphs.length - 1 ? " is-current" : ""}`}
                    >
                      {lines.map((line, lineIndex) => (
                        <span key={`${paragraph.id}-${lineIndex}`}>
                          {line}
                          {lineIndex < lines.length - 1 ? <br /> : null}
                        </span>
                      ))}
                    </div>
                    {illustrations.map((illustration) => {
                      const isReference = availableReferences.some(
                        (item) => item.illustration.id === illustration.id,
                      );
                      const image = (
                        <img
                          src={sourceIllustrationUrl(selectedBook.path, illustration)}
                          alt={illustration.title ?? "原书插图"}
                        />
                      );
                      return (
                        <figure className="source-illustration" key={illustration.id}>
                          {isReference ? (
                            <button
                              type="button"
                              data-interactive="true"
                              aria-label={`在资料图册中查看${illustration.title ?? "这张插图"}`}
                              onClick={() => openReferenceForIllustration(illustration.id)}
                            >
                              {image}
                            </button>
                          ) : image}
                          {illustration.title ? <figcaption>{illustration.title}</figcaption> : null}
                        </figure>
                      );
                    })}
                  </div>
                );
              })}
              {currentIndex === lastIndex ? <p className="end-mark">— 完 —</p> : null}
            </div>
          </section>

          <footer className="reader-footer" data-interactive="true">
            <button
              className="nav-button"
              type="button"
              data-interactive="true"
              disabled={currentIndex <= firstIndex}
              onClick={previous}
            >
              <span aria-hidden="true">←</span>上一段
            </button>
            <div className="now-playing">
              <span aria-hidden="true">♪</span>
              <span>{settings.pureMode ? "纯净阅读" : trackName}</span>
              <small>{Math.round(progress)}%</small>
            </div>
            <button
              className="nav-button nav-button--next"
              type="button"
              data-interactive="true"
              disabled={currentIndex >= lastIndex}
              onClick={next}
            >
              {currentIndex >= lastIndex ? "已读完" : "下一段"}
              <span aria-hidden="true">→</span>
            </button>
          </footer>

          {settingsOpen ? (
            <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
          ) : null}
          {historyOpen ? (
            <HistoryPanel
              paragraphs={historyParagraphs}
              firstIndex={firstIndex}
              currentIndex={currentIndex}
              furthestReadIndex={furthestReadIndex}
              currentItemRef={currentHistoryItemRef}
              onClose={() => setHistoryOpen(false)}
              onJump={jumpToHistory}
              onReturnToLatest={returnToLatest}
            />
          ) : null}
          {referencesOpen ? (
            <ReferenceGallery
              items={availableReferences}
              selectedId={selectedReferenceId}
              onSelect={setSelectedReferenceId}
              onClose={() => setReferencesOpen(false)}
              onJump={jumpToReference}
            />
          ) : null}
          {audioError ? <div className="audio-notice">{audioError}，已继续纯文本阅读。</div> : null}
          <div className="advance-hint" aria-hidden="true">空格继续 · ↑ 回顾</div>
        </>
      )}
    </main>
  );
}

interface CoverScreenProps {
  title: string;
  production: BookProductionMode;
  hasProgress: boolean;
  hasPreferredStart: boolean;
  progress: number;
  onContinue: () => void;
  onStartPreferred: () => void;
  onStartBeginning: () => void;
  onLibrary: () => void;
}

const coverKickers: Record<BookProductionMode, string> = {
  manual: "沉浸阅读 · 手工导演版",
  "agent-assisted": "沉浸阅读 · Agent 导演版",
  automated: "沉浸阅读 · 自动导演版",
};

function CoverScreen({
  title,
  production,
  hasProgress,
  hasPreferredStart,
  progress,
  onContinue,
  onStartPreferred,
  onStartBeginning,
  onLibrary,
}: CoverScreenProps) {
  return (
    <section className="cover-screen">
      <button className="cover-library-action" type="button" onClick={onLibrary}>
        <span aria-hidden="true">←</span> 返回书库
      </button>
      <p className="cover-kicker">{coverKickers[production]}</p>
      <h1>{title}</h1>
      <p className="cover-summary">原书负责说什么，导演只决定怎么呈现。</p>
      <div className="cover-actions">
        <button
          className="primary-action"
          type="button"
          onClick={hasProgress ? onContinue : hasPreferredStart ? onStartPreferred : onStartBeginning}
        >
          {hasProgress
            ? `继续阅读 · ${Math.round(progress)}%`
            : hasPreferredStart
              ? "从正文开始"
              : "开始阅读"}
          <span aria-hidden="true">→</span>
        </button>
        {hasProgress && hasPreferredStart ? (
          <button className="text-action" type="button" onClick={onStartPreferred}>从正文开始</button>
        ) : null}
        {hasProgress || hasPreferredStart ? (
          <button className="text-action" type="button" onClick={onStartBeginning}>查看前置内容</button>
        ) : null}
      </div>
      <p className="cover-note">开始后将播放低音量环境声，可随时静音或切换纯净模式。</p>
    </section>
  );
}

interface HistoryPanelProps {
  paragraphs: Paragraph[];
  firstIndex: number;
  currentIndex: number;
  furthestReadIndex: number;
  currentItemRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onJump: (index: number) => void;
  onReturnToLatest: () => void;
}

function HistoryPanel({
  paragraphs,
  firstIndex,
  currentIndex,
  furthestReadIndex,
  currentItemRef,
  onClose,
  onJump,
  onReturnToLatest,
}: HistoryPanelProps) {
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
            <span>已读 {paragraphs.length} 段 · 点击任意段落跳转</span>
          </div>
          <button type="button" aria-label="关闭阅读历史" onClick={onClose}>×</button>
        </header>

        <div className="history-list">
          {paragraphs.map((paragraph, offset) => {
            const paragraphIndex = firstIndex + offset;
            const isCurrent = paragraphIndex === currentIndex;
            const isLatest = paragraphIndex === furthestReadIndex;
            return (
              <button
                className={`history-entry${isCurrent ? " is-current" : ""}${isLatest ? " is-latest" : ""}`}
                type="button"
                key={paragraph.id}
                ref={isCurrent ? currentItemRef : undefined}
                aria-current={isCurrent ? "true" : undefined}
                onClick={() => onJump(paragraphIndex)}
              >
                <span className="history-entry__number">
                  {String(offset + 1).padStart(3, "0")}
                </span>
                <span className="history-entry__text">{paragraph.text}</span>
                {isLatest ? <span className="history-entry__latest">最新</span> : null}
              </button>
            );
          })}
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

interface SettingsPanelProps {
  settings: ReaderSettings;
  onChange: React.Dispatch<React.SetStateAction<ReaderSettings>>;
  onClose: () => void;
}

function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  function update<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) {
    onChange((current) => ({ ...current, [key]: value }));
  }

  return (
    <aside className="settings-panel" data-interactive="true" aria-label="阅读设置">
      <div className="settings-heading">
        <div><p>阅读设置</p><span>所有设置保存在本机</span></div>
        <button type="button" aria-label="关闭设置" onClick={onClose}>×</button>
      </div>
      <ToggleSetting
        title="纯净阅读"
        note="关闭背景、音乐与环境音"
        checked={settings.pureMode}
        onChange={(checked) => update("pureMode", checked)}
      />
      <ToggleSetting
        title="静音"
        note="保留视觉演出"
        checked={settings.muted}
        onChange={(checked) => update("muted", checked)}
      />
      <ToggleSetting
        title="减少动态效果"
        note="关闭平滑滚动与长转场"
        checked={settings.reducedMotion}
        onChange={(checked) => update("reducedMotion", checked)}
      />
      <RangeSetting label="字号" value={settings.fontScale} min={0.85} max={1.3} step={0.05} display={`${Math.round(settings.fontScale * 100)}%`} onChange={(value) => update("fontScale", value)} />
      <RangeSetting label="音乐" value={settings.musicVolume} min={0} max={1} step={0.05} display={`${Math.round(settings.musicVolume * 100)}%`} onChange={(value) => update("musicVolume", value)} />
      <RangeSetting label="环境音" value={settings.ambienceVolume} min={0} max={1} step={0.05} display={`${Math.round(settings.ambienceVolume * 100)}%`} onChange={(value) => update("ambienceVolume", value)} />
    </aside>
  );
}

function ToggleSetting({ title, note, checked, onChange }: { title: string; note: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span><strong>{title}</strong><small>{note}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

interface RangeSettingProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

function RangeSetting({ label, value, min, max, step, display, onChange }: RangeSettingProps) {
  return (
    <label className="range-setting">
      <span><strong>{label}</strong><small>{display}</small></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ErrorScreen({
  message,
  onBack,
}: {
  message: string;
  onBack?: () => void;
}) {
  return (
    <main className="error-screen">
      <p className="error-screen__code">BOOK_LOAD_FAILED</p>
      <h1>书页没有装订成功</h1>
      <p>{message}</p>
      {onBack ? (
        <button className="primary-action" type="button" onClick={onBack}>
          返回书库
        </button>
      ) : null}
      <code>cd /Users/empathy/Jade<br />direnv exec . just dev</code>
      <p className="error-screen__hint">请通过开发服务器访问 http://localhost:5173</p>
    </main>
  );
}

function requestedBookFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("book");
}

function updateBookUrl(bookPath: string | null): void {
  const url = new URL(window.location.href);
  if (bookPath) {
    url.searchParams.set("book", bookPath);
  } else {
    url.searchParams.delete("book");
  }
  window.history.pushState({}, "", url);
}

function loadSettings(): ReaderSettings {
  const defaults: ReaderSettings = {
    fontScale: 1,
    masterVolume: 0.9,
    musicVolume: 0.55,
    ambienceVolume: 0.5,
    muted: false,
    pureMode: false,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  };
  const saved = safeGet(SETTINGS_KEY);
  if (!saved) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(saved) as Partial<ReaderSettings>) };
  } catch {
    return defaults;
  }
}

function safeGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}

function safeRemove(key: string): void {
  try { window.localStorage.removeItem(key); } catch { /* Storage is optional. */ }
}
