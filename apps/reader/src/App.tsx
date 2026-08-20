import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LibraryScreen } from "./LibraryScreen";
import { BackgroundStage } from "./reader/BackgroundStage";
import { CoverScreen } from "./reader/CoverScreen";
import {
  assetUrl,
  findLibraryBook,
  indexAssets,
  loadBookBundle,
  loadLibrary,
} from "./reader/data";
import { HistoryPanel } from "./reader/HistoryPanel";
import { safeGet, safeRemove, safeSet } from "./reader/localStorage";
import { ReadingViewport } from "./reader/ReadingViewport";
import { ReferenceGallery } from "./reader/ReferenceGallery";
import { resolveGuideReferences } from "./reader/guideReferences";
import { loadSettings, SETTINGS_KEY } from "./reader/readerSettings";
import type { ReaderSettings } from "./reader/readerSettings";
import {
  firstReadableIndex,
  moveReadingCursor,
  nextBackgroundAssetId,
  paragraphIndex,
  preferredStartIndex,
  progressIndex,
  progressStorageKey,
  resolvePlaybackAt,
  sceneAt,
  sourceProgressStorageKey,
  visibleStartIndex,
} from "./reader/readerState";
import type { ReadingCursor } from "./reader/readerState";
import { keepParagraphAboveBottomFade } from "./reader/readingScroll";
import { ErrorScreen, LoadingScreen } from "./reader/screens";
import { SettingsPanel } from "./reader/SettingsPanel";
import type {
  Asset,
  BookBundle,
  LibraryBook,
  LibraryDocument,
  ResolvedPlaybackState,
  SourceIllustration,
} from "./reader/types";
import { unlockAudio, useAudioDirector } from "./reader/useAudioDirector";

/** Shown before a bundle loads: no background, no music, no ambience. */
const SILENT_PLAYBACK: ResolvedPlaybackState = {
  background: null,
  music: null,
  ambience: [],
  sceneId: null,
  cue: null,
};

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
    // Switching books discards the previous book's UI state before its bundle
    // arrives, so no panel or reading position survives into the next book.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on book change
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
        const positions = paragraphIndex(loaded.source);
        const savedId = safeGet(sourceProgressStorageKey(loaded.source));
        const sourceStart = firstReadableIndex(loaded.source);
        const preferredStart = preferredStartIndex(loaded.source, loaded.guide, positions);
        const savedIndex = savedId
          ? progressIndex(loaded.source, savedId, positions)
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
    () => (bundle ? indexAssets(bundle.assets) : new Map<string, Asset>()),
    [bundle],
  );
  // Built once per bundle: every per-paragraph lookup below reuses it rather
  // than walking the whole book again.
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
  const referenceIllustrationIds = useMemo(
    () => new Set(availableReferences.map((item) => item.illustration.id)),
    [availableReferences],
  );
  const illustrationsByAnchor = useMemo(() => {
    const grouped = new Map<string, SourceIllustration[]>();
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
        ? resolvePlaybackAt(sourcePositions, bundle.playback, currentIndex)
        : SILENT_PLAYBACK,
    [bundle, currentIndex, sourcePositions],
  );
  const audioError = useAudioDirector({
    started,
    bookPath: selectedBook?.path ?? null,
    playback: playbackState,
    assets,
    settings,
  });

  const activeScene = useMemo(
    () => (bundle ? sceneAt(sourcePositions, bundle.direction, currentIndex) : null),
    [bundle, currentIndex, sourcePositions],
  );
  const sourceFirstIndex = bundle ? firstReadableIndex(bundle.source) : 1;
  const preferredIndex = bundle
    ? preferredStartIndex(bundle.source, bundle.guide, sourcePositions)
    : 1;
  const firstIndex = bundle ? readingFloorIndex : 1;
  const lastIndex = bundle ? bundle.source.paragraphs.length - 1 : 1;
  const visibleStart = useMemo(
    () =>
      bundle
        ? visibleStartIndex(sourcePositions, bundle.playback, currentIndex, firstIndex)
        : firstIndex,
    [bundle, currentIndex, firstIndex, sourcePositions],
  );
  const visibleParagraphs = useMemo(
    () => (bundle ? bundle.source.paragraphs.slice(visibleStart, currentIndex + 1) : []),
    [bundle, currentIndex, visibleStart],
  );
  // A book whose preferred start is its own last paragraph would divide by zero.
  const bodyLength = bundle
    ? Math.max(1, bundle.source.paragraphs.length - preferredIndex)
    : 1;
  const bodyPosition = Math.max(0, furthestReadIndex - preferredIndex + 1);
  const progress = Math.min(100, (bodyPosition / bodyLength) * 100);
  const sceneNumber = useMemo(
    () =>
      bundle && activeScene
        ? bundle.direction.scenes.findIndex((scene) => scene.id === activeScene.id) + 1
        : 1,
    [activeScene, bundle],
  );
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

  // Fetch the next scene's background while the reader is still on this one, so
  // the crossfade has a decoded image to fade into.
  const upcomingBackgroundSrc = useMemo(() => {
    if (!bundle || !selectedBook || settings.pureMode) return null;
    const assetId = nextBackgroundAssetId(sourcePositions, bundle.playback, currentIndex);
    const asset = assetId ? assets.get(assetId) : undefined;
    return asset ? assetUrl(selectedBook.path, asset) : null;
  }, [assets, bundle, currentIndex, selectedBook, settings.pureMode, sourcePositions]);

  useEffect(() => {
    if (!started || !upcomingBackgroundSrc) return;
    const image = new Image();
    image.decoding = "async";
    image.src = upcomingBackgroundSrc;
  }, [started, upcomingBackgroundSrc]);

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
      sourceProgressStorageKey(bundle.source),
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
      safeRemove(sourceProgressStorageKey(bundle.source));
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
    return <LoadingScreen message="正在装订书页…" />;
  }

  if (!selectedBook) {
    return (
      <LibraryScreen
        books={library.books}
        hasProgress={(book) =>
          Boolean(safeGet(progressStorageKey(book.book_id, book.source_revision)))
        }
        onSelect={selectBook}
      />
    );
  }

  if (!bundle) {
    return <LoadingScreen message={`正在装订《${selectedBook.title}》…`} />;
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

          <ReadingViewport
            bookPath={selectedBook.path}
            paragraphs={visibleParagraphs}
            illustrationsByAnchor={illustrationsByAnchor}
            referenceIllustrationIds={referenceIllustrationIds}
            atEnd={currentIndex === lastIndex}
            viewportRef={readingViewportRef}
            latestParagraphRef={latestParagraphRef}
            onOpenReference={openReferenceForIllustration}
          />

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
              paragraphs={bundle.source.paragraphs}
              firstIndex={firstIndex}
              currentIndex={currentIndex}
              furthestReadIndex={furthestReadIndex}
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
