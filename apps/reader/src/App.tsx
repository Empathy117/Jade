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
import { ChapterPanel } from "./reader/ChapterPanel";
import { unlockedChapters } from "./reader/chapters";
import {
  codexSeenStorageKey,
  EMPTY_CODEX_VIEW,
  unlockedAnchorPositions,
  unlockedCodex,
} from "./reader/codex";
import { CodexPanel } from "./reader/CodexPanel";
import type { CodexTab } from "./reader/CodexPanel";
import { HistoryPanel } from "./reader/HistoryPanel";
import { safeGet, safeKeys, safeRemove, safeSet } from "./reader/localStorage";
import { resolveSwipe } from "./reader/touch";
import { ReadingViewport } from "./reader/ReadingViewport";
import type { VisibleReadingBeat } from "./reader/ReadingViewport";
import { readingBeats } from "./reader/readingBeats";
import { keepParagraphAboveBottomFade } from "./reader/readingScroll";
import { resolveGuideReferences } from "./reader/guideReferences";
import { loadSettings, SETTINGS_KEY } from "./reader/readerSettings";
import type { ReaderSettings } from "./reader/readerSettings";
import {
  chapterNotes,
  flowPositionCounts,
  isFlowParagraph,
  lastFlowIndex,
  nextFlowIndex,
  previousFlowIndex,
  snapToFlow,
} from "./reader/notes";
import { NotePopover } from "./reader/NotePopover";
import {
  firstReadableIndex,
  moveReadingCursor,
  nextBackgroundAssetId,
  paragraphIndex,
  preferredStartIndex,
  progressIndex,
  progressStorageKey,
  readingBeatStorageKey,
  resolvePlaybackAt,
  sceneAt,
  sourceProgressStorageKey,
  sourceReadingBeatStorageKey,
  visibleStartIndex,
} from "./reader/readerState";
import type { ReadingCursor } from "./reader/readerState";
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
  const [beatIndex, setBeatIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [openNoteIndex, setOpenNoteIndex] = useState<number | null>(null);
  const [codexIntent, setCodexIntent] = useState<{
    tab: CodexTab | null;
    referenceId: string | null;
  }>({ tab: null, referenceId: null });
  // Furthest-read position at the previous dossier visit; anything anchored
  // later is new to the reader and lights the badge dot.
  const [codexSeenIndex, setCodexSeenIndex] = useState(-1);
  // Snapshot handed to an opening panel, so its 「新」 marks hold steady while
  // the live watermark advances the moment the panel opens.
  const [codexPanelSeen, setCodexPanelSeen] = useState(-1);
  const [readingFloorIndex, setReadingFloorIndex] = useState(1);
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const readingViewportRef = useRef<HTMLElement | null>(null);
  const latestParagraphRef = useRef<HTMLDivElement | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
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
    setChaptersOpen(false);
    setCodexOpen(false);
    setCodexIntent({ tab: null, referenceId: null });
    setOpenNoteIndex(null);
    setBeatIndex(0);
    setBundle(null);
    setLoadError(null);
    if (!selectedBook) return () => { cancelled = true; };

    loadBookBundle(selectedBook)
      .then((loaded) => {
        if (cancelled) return;
        const positions = paragraphIndex(loaded.source);
        const savedId = safeGet(sourceProgressStorageKey(loaded.source));
        const savedBeat = safeGet(sourceReadingBeatStorageKey(loaded.source));
        const sourceStart = firstReadableIndex(loaded.source);
        const preferredStart = preferredStartIndex(loaded.source, loaded.guide, positions);
        const savedIndex = snapToFlow(
          loaded.source.paragraphs,
          savedId ? progressIndex(loaded.source, savedId, positions) : preferredStart,
        );
        setBundle(loaded);
        setHasSavedProgress(Boolean(savedId));
        removeStaleProgress(loaded.source.book_id, loaded.source.revision);
        const savedSeen = safeGet(
          codexSeenStorageKey(loaded.source.book_id, loaded.source.revision),
        );
        const parsedSeen = savedSeen === null ? Number.NaN : Number.parseInt(savedSeen, 10);
        setCodexSeenIndex(Number.isFinite(parsedSeen) ? parsedSeen : -1);
        setReadingFloorIndex(savedIndex < preferredStart ? sourceStart : preferredStart);
        setCursor({
          currentIndex: savedIndex,
          furthestReadIndex: savedIndex,
        });
        const parsedBeat = savedBeat === null ? Number.NaN : Number.parseInt(savedBeat, 10);
        setBeatIndex(savedId && Number.isFinite(parsedBeat) ? Math.max(0, parsedBeat) : 0);
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
  const codexView = useMemo(
    () =>
      bundle
        ? unlockedCodex(bundle.codex, bundle.direction, sourcePositions, furthestReadIndex)
        : EMPTY_CODEX_VIEW,
    [bundle, furthestReadIndex, sourcePositions],
  );
  const codexHasContent =
    codexView.hasPeople || codexView.hasAtlas || availableReferences.length > 0;
  const codexHasFresh = useMemo(() => {
    if (!bundle) return false;
    const anchors = unlockedAnchorPositions(bundle.codex, sourcePositions, furthestReadIndex);
    for (const item of availableReferences) {
      const position = sourcePositions.get(item.illustration.at);
      if (position !== undefined) anchors.push(position);
    }
    return anchors.some((position) => position > codexSeenIndex);
  }, [availableReferences, bundle, codexSeenIndex, furthestReadIndex, sourcePositions]);
  const chapters = useMemo(
    () =>
      bundle
        ? unlockedChapters(bundle.source.paragraphs, readingFloorIndex, furthestReadIndex)
        : [],
    [bundle, furthestReadIndex, readingFloorIndex],
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
  const lastIndex = bundle ? lastFlowIndex(bundle.source.paragraphs) : 1;
  const flowCounts = useMemo(
    () => (bundle ? flowPositionCounts(bundle.source.paragraphs) : []),
    [bundle],
  );
  const currentChapterNotes = useMemo(
    () => (bundle ? chapterNotes(bundle.source.paragraphs, currentIndex) : new Map<string, number>()),
    [bundle, currentIndex],
  );
  const currentBeats = useMemo(
    () => (bundle ? readingBeats(bundle.source.paragraphs[currentIndex]) : []),
    [bundle, currentIndex],
  );
  const activeBeatIndex = Math.min(beatIndex, Math.max(0, currentBeats.length - 1));
  const visibleStart = useMemo(
    () =>
      bundle
        ? visibleStartIndex(sourcePositions, bundle.playback, currentIndex, firstIndex)
        : firstIndex,
    [bundle, currentIndex, firstIndex, sourcePositions],
  );
  const visibleBeats = useMemo<VisibleReadingBeat[]>(
    () => {
      if (!bundle) return [];
      const result: VisibleReadingBeat[] = [];
      for (let index = visibleStart; index <= currentIndex; index += 1) {
        const sourceParagraph = bundle.source.paragraphs[index];
        if (!isFlowParagraph(sourceParagraph)) continue;
        const beats = readingBeats(sourceParagraph);
        const lastVisibleBeat =
          index === currentIndex ? activeBeatIndex : beats.length - 1;
        for (let beat = 0; beat <= lastVisibleBeat; beat += 1) {
          result.push({
            key: `${sourceParagraph.id}-${beat}`,
            paragraph: { ...sourceParagraph, text: beats[beat].text },
            beatIndex: beat,
            beatCount: beats.length,
            current: index === currentIndex && beat === activeBeatIndex,
            showIllustrations:
              beat === beats.length - 1 &&
              (index < currentIndex || activeBeatIndex === beats.length - 1),
          });
        }
      }
      return result;
    },
    [activeBeatIndex, bundle, currentIndex, visibleStart],
  );
  // Progress counts only flow paragraphs: a scholarly edition can carry as many
  // annotation paragraphs as prose, and those never enter the tap-through path.
  const bodyLength = bundle
    ? Math.max(1, (flowCounts[flowCounts.length - 1] ?? 1) - (flowCounts[preferredIndex] ?? 0))
    : 1;
  const bodyPosition = Math.max(
    0,
    (flowCounts[furthestReadIndex] ?? 0) - (flowCounts[preferredIndex] ?? 0) + 1,
  );
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
    if (!bundle) return;
    if (activeBeatIndex < currentBeats.length - 1) {
      setBeatIndex(activeBeatIndex + 1);
      return;
    }
    if (currentIndex >= lastIndex) return;
    setBeatIndex(0);
    setCursor((current) =>
      moveReadingCursor(
        bundle.source,
        current,
        nextFlowIndex(bundle.source.paragraphs, current.currentIndex),
      ),
    );
  }, [activeBeatIndex, bundle, currentBeats.length, currentIndex, lastIndex]);

  const previous = useCallback(() => {
    if (!bundle) return;
    if (activeBeatIndex > 0) {
      setBeatIndex(activeBeatIndex - 1);
      return;
    }
    const targetIndex = previousFlowIndex(
      bundle.source.paragraphs,
      currentIndex,
      readingFloorIndex,
    );
    const targetBeats = readingBeats(bundle.source.paragraphs[targetIndex]);
    setBeatIndex(Math.max(0, targetBeats.length - 1));
    setCursor((current) =>
      moveReadingCursor(
        bundle.source,
        current,
        targetIndex,
      ),
    );
  }, [activeBeatIndex, bundle, currentIndex, readingFloorIndex]);

  useEffect(() => {
    if (!started || !bundle) return;
    safeSet(
      sourceProgressStorageKey(bundle.source),
      bundle.source.paragraphs[furthestReadIndex].id,
    );
  }, [bundle, furthestReadIndex, started]);

  useEffect(() => {
    if (!started || !bundle || currentIndex !== furthestReadIndex) return;
    safeSet(sourceReadingBeatStorageKey(bundle.source), String(activeBeatIndex));
  }, [activeBeatIndex, bundle, currentIndex, furthestReadIndex, started]);

  useEffect(() => {
    if (!started || historyOpen) return;
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
  }, [activeBeatIndex, currentIndex, historyOpen, settings.reducedMotion, started]);

  useEffect(() => {
    if (!started) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isFormControl = target?.matches("input, select, textarea");
      if (event.key === "ArrowUp" && !isFormControl) {
        event.preventDefault();
        setSettingsOpen(false);
        setCodexOpen(false);
        setChaptersOpen(false);
        setHistoryOpen((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setHistoryOpen(false);
        setChaptersOpen(false);
        setCodexOpen(false);
        setOpenNoteIndex(null);
        return;
      }
      if (target?.matches("input, button, select, textarea")) return;
      if (historyOpen || chaptersOpen || codexOpen) return;
      if (openNoteIndex !== null) {
        // Any advance key first puts the annotation away.
        if (event.key === " " || event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          setOpenNoteIndex(null);
        }
        return;
      }
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
  }, [chaptersOpen, codexOpen, historyOpen, next, openNoteIndex, previous, started]);

  function beginReading(mode: "resume" | "preferred" | "beginning") {
    if (!bundle) return;
    if (mode !== "resume") {
      const startIndex = mode === "preferred" ? preferredIndex : sourceFirstIndex;
      setCursor({
        currentIndex: startIndex,
        furthestReadIndex: startIndex,
      });
      setBeatIndex(0);
      setReadingFloorIndex(startIndex);
      safeRemove(sourceProgressStorageKey(bundle.source));
      safeRemove(sourceReadingBeatStorageKey(bundle.source));
      setHasSavedProgress(false);
    }
    unlockAudio();
    setStarted(true);
  }

  function toggleHistory() {
    setSettingsOpen(false);
    setCodexOpen(false);
    setChaptersOpen(false);
    setHistoryOpen((open) => !open);
  }

  function toggleChapters() {
    setSettingsOpen(false);
    setCodexOpen(false);
    setHistoryOpen(false);
    setChaptersOpen((open) => !open);
  }

  function jumpToChapter(targetIndex: number) {
    if (!bundle) return;
    setCursor((current) => moveReadingCursor(bundle.source, current, targetIndex));
    setBeatIndex(0);
    setChaptersOpen(false);
  }

  function openCodex(tab: CodexTab | null, referenceId: string | null) {
    setSettingsOpen(false);
    setHistoryOpen(false);
    setChaptersOpen(false);
    setCodexIntent({ tab, referenceId });
    if (!codexOpen && bundle) {
      // The panel keeps the previous watermark for its 「新」 marks; the live
      // watermark advances now, so the badge dot goes out once this closes.
      setCodexPanelSeen(codexSeenIndex);
      const seen = Math.max(codexSeenIndex, furthestReadIndex);
      setCodexSeenIndex(seen);
      safeSet(
        codexSeenStorageKey(bundle.source.book_id, bundle.source.revision),
        String(seen),
      );
    }
    setCodexOpen(true);
  }

  function toggleCodex() {
    if (codexOpen) {
      setCodexOpen(false);
      return;
    }
    openCodex(null, null);
  }

  function openReferenceForIllustration(illustrationId: string) {
    const item = availableReferences.find(
      (reference) => reference.illustration.id === illustrationId,
    );
    if (!item) return;
    openCodex("gallery", item.reference.id);
  }

  function jumpFromCodex(paragraphId: string) {
    if (!bundle) return;
    const targetIndex = sourcePositions.get(paragraphId);
    if (targetIndex === undefined) return;
    if (targetIndex < readingFloorIndex) setReadingFloorIndex(sourceFirstIndex);
    setCursor((current) =>
      moveReadingCursor(
        bundle.source,
        current,
        snapToFlow(bundle.source.paragraphs, targetIndex),
      ),
    );
    setBeatIndex(0);
    setCodexOpen(false);
  }

  function openNoteMarker(marker: string) {
    const noteIndex = currentChapterNotes.get(marker);
    if (noteIndex === undefined) return;
    // Drop focus from the tapped marker so Space returns to page-turning
    // once the annotation is dismissed.
    (document.activeElement as HTMLElement | null)?.blur();
    setSettingsOpen(false);
    setHistoryOpen(false);
    setChaptersOpen(false);
    setCodexOpen(false);
    setOpenNoteIndex(noteIndex);
  }

  function jumpToHistory(targetIndex: number) {
    if (!bundle) return;
    setCursor((current) => moveReadingCursor(bundle.source, current, targetIndex));
    setBeatIndex(0);
    setHistoryOpen(false);
  }

  function returnToLatest() {
    setCursor((current) => ({
      ...current,
      currentIndex: current.furthestReadIndex,
    }));
    setBeatIndex(0);
    setHistoryOpen(false);
  }

  function handleReaderClick(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-interactive='true']")) return;
    next();
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-interactive='true']")) {
      touchOrigin.current = null;
      return;
    }
    const touch = event.touches[0];
    touchOrigin.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    const origin = touchOrigin.current;
    touchOrigin.current = null;
    if (!origin || historyOpen || chaptersOpen || codexOpen || settingsOpen) return;
    if (openNoteIndex !== null) {
      setOpenNoteIndex(null);
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    const action = resolveSwipe(touch.clientX - origin.x, touch.clientY - origin.y);
    if (action === "next") next();
    if (action === "previous") previous();
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
      className={`reader-app${started ? " is-reading" : " is-cover"}${settings.pureMode ? " is-pure" : ""}${settings.reducedMotion ? " is-reduced-motion" : ""}${settings.sansFont ? " is-font-sans" : ""}`}
      style={{ "--font-scale": settings.fontScale } as React.CSSProperties}
      onClick={started ? handleReaderClick : undefined}
      onTouchStart={started ? handleTouchStart : undefined}
      onTouchEnd={started ? handleTouchEnd : undefined}
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
              {codexHasContent ? (
                <button
                  className={`icon-button icon-button--codex${codexHasFresh ? " has-fresh" : ""}`}
                  type="button"
                  data-interactive="true"
                  aria-label="档案"
                  aria-expanded={codexOpen}
                  title={codexHasFresh ? "档案（有新解锁）" : "档案"}
                  onClick={toggleCodex}
                >
                  <span aria-hidden="true">档</span>
                </button>
              ) : null}
              {chapters.length > 0 ? (
                <button
                  className="icon-button icon-button--chapters"
                  type="button"
                  data-interactive="true"
                  aria-label="章节目录"
                  aria-expanded={chaptersOpen}
                  title={`章节目录（已解锁 ${chapters.length} 章）`}
                  onClick={toggleChapters}
                >
                  <span aria-hidden="true">目</span>
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
                  setCodexOpen(false);
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
            beats={visibleBeats}
            illustrationsByAnchor={illustrationsByAnchor}
            referenceIllustrationIds={referenceIllustrationIds}
            noteMarkers={currentChapterNotes}
            atEnd={currentIndex === lastIndex && activeBeatIndex === currentBeats.length - 1}
            viewportRef={readingViewportRef}
            latestParagraphRef={latestParagraphRef}
            onOpenReference={openReferenceForIllustration}
            onOpenNote={openNoteMarker}
          />

          <footer className="reader-footer" data-interactive="true">
            <button
              className="nav-button"
              type="button"
              data-interactive="true"
              disabled={currentIndex <= firstIndex && activeBeatIndex === 0}
              onClick={previous}
            >
              <span aria-hidden="true">←</span>上一页
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
              disabled={currentIndex >= lastIndex && activeBeatIndex >= currentBeats.length - 1}
              onClick={next}
            >
              {currentIndex >= lastIndex && activeBeatIndex >= currentBeats.length - 1
                ? "已读完"
                : "下一页"}
              <span aria-hidden="true">→</span>
            </button>
          </footer>

          {settingsOpen ? (
            <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
          ) : null}
          {chaptersOpen ? (
            <ChapterPanel
              chapters={chapters}
              currentIndex={currentIndex}
              onClose={() => setChaptersOpen(false)}
              onJump={jumpToChapter}
            />
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
          {codexOpen ? (
            <CodexPanel
              view={codexView}
              references={availableReferences}
              bookPath={selectedBook.path}
              activeLocation={activeScene?.location ?? null}
              seenIndex={codexPanelSeen}
              positions={sourcePositions}
              initialTab={codexIntent.tab}
              initialReferenceId={codexIntent.referenceId}
              onJump={jumpFromCodex}
              onClose={() => setCodexOpen(false)}
            />
          ) : null}
          {openNoteIndex !== null ? (
            <NotePopover
              paragraph={bundle.source.paragraphs[openNoteIndex]}
              illustrations={
                illustrationsByAnchor.get(bundle.source.paragraphs[openNoteIndex].id) ?? []
              }
              bookPath={selectedBook.path}
              onClose={() => setOpenNoteIndex(null)}
            />
          ) : null}
          {audioError ? <div className="audio-notice">{audioError}，已继续纯文本阅读。</div> : null}
          <div className="advance-hint" aria-hidden="true">空格继续 · ↑ 回顾</div>
        </>
      )}
    </main>
  );
}

/**
 * Drop progress and dossier watermarks saved under other revisions of the book.
 *
 * A re-import bumps the revision and paragraph ids may no longer line up, so
 * the old keys can never be read again — they would otherwise sit in
 * localStorage forever.
 */
function removeStaleProgress(bookId: string, revision: number): void {
  const keep = new Set([
    progressStorageKey(bookId, revision),
    readingBeatStorageKey(bookId, revision),
    codexSeenStorageKey(bookId, revision),
  ]);
  const prefixes = [
    `immersive-reader:${bookId}:revision-`,
    `immersive-reader:${bookId}:reading-beat:revision-`,
    `immersive-reader:${bookId}:codex-seen:revision-`,
  ];
  for (const key of safeKeys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix)) && !keep.has(key)) {
      safeRemove(key);
    }
  }
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
