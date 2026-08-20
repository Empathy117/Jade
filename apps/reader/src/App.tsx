import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BackgroundStage } from "./reader/BackgroundStage";
import { assetUrl, indexAssets, loadDemoBundle } from "./reader/data";
import {
  firstReadableIndex,
  progressIndex,
  progressStorageKey,
  resolvePlaybackAt,
  sceneAt,
  visibleStartIndex,
} from "./reader/readerState";
import { keepParagraphAboveBottomFade } from "./reader/readingScroll";
import type { DemoBundle } from "./reader/types";
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

const sceneNames: Record<string, string> = {
  scene_001: "深山",
  scene_002: "山猫轩",
  scene_003: "蓝色的门",
  scene_004: "接连的要求",
  scene_005: "最后一项",
  scene_006: "钥匙孔",
  scene_007: "雾散之后",
};

const trackNames: Record<string, string> = {
  bgm_forest_stillness: "林间静息",
  bgm_corridor_unease: "无人的走廊",
  bgm_final_door_tension: "门后",
};

export function App() {
  const [bundle, setBundle] = useState<DemoBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const readingViewportRef = useRef<HTMLElement | null>(null);
  const latestParagraphRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDemoBundle()
      .then((loaded) => {
        if (cancelled) return;
        const savedId = safeGet(progressStorageKey(loaded.source));
        setBundle(loaded);
        setHasSavedProgress(Boolean(savedId));
        setCurrentIndex(progressIndex(loaded.source, savedId));
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

  useEffect(() => safeSet(SETTINGS_KEY, JSON.stringify(settings)), [settings]);

  const assets = useMemo(
    () => (bundle ? indexAssets(bundle.assets) : new Map()),
    [bundle],
  );
  const playbackState = useMemo(
    () =>
      bundle
        ? resolvePlaybackAt(bundle.source, bundle.playback, currentIndex)
        : { background: null, music: null, ambience: [], sceneId: null, cue: null },
    [bundle, currentIndex],
  );
  const audioError = useAudioDirector({
    started,
    playback: playbackState,
    assets,
    settings,
  });

  const activeScene = useMemo(
    () => (bundle ? sceneAt(bundle.source, bundle.direction, currentIndex) : null),
    [bundle, currentIndex],
  );
  const firstIndex = bundle ? firstReadableIndex(bundle.source) : 1;
  const lastIndex = bundle ? bundle.source.paragraphs.length - 1 : 1;
  const visibleStart = bundle
    ? visibleStartIndex(bundle.source, bundle.playback, currentIndex)
    : firstIndex;
  const visibleParagraphs = bundle
    ? bundle.source.paragraphs.slice(visibleStart, currentIndex + 1)
    : [];
  const bodyLength = bundle ? bundle.source.paragraphs.length - firstIndex : 1;
  const bodyPosition = Math.max(1, currentIndex - firstIndex + 1);
  const progress = Math.min(100, (bodyPosition / bodyLength) * 100);
  const sceneNumber = bundle && activeScene
    ? bundle.direction.scenes.findIndex((scene) => scene.id === activeScene.id) + 1
    : 1;
  const backgroundAsset = playbackState.background
    ? assets.get(playbackState.background.asset_id)
    : undefined;
  const backgroundSrc = backgroundAsset ? assetUrl(backgroundAsset) : null;
  const trackName = playbackState.music
    ? trackNames[playbackState.music.asset_id] ?? playbackState.music.asset_id
    : "无音乐";

  const next = useCallback(() => {
    if (!bundle || currentIndex >= bundle.source.paragraphs.length - 1) return;
    setCurrentIndex((index) => index + 1);
  }, [bundle, currentIndex]);

  const previous = useCallback(() => {
    if (!bundle) return;
    setCurrentIndex((index) => Math.max(firstReadableIndex(bundle.source), index - 1));
  }, [bundle]);

  useEffect(() => {
    if (!started || !bundle) return;
    safeSet(progressStorageKey(bundle.source), bundle.source.paragraphs[currentIndex].id);
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
  }, [bundle, currentIndex, settings.reducedMotion, started]);

  useEffect(() => {
    if (!started) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, button, select, textarea")) return;
      if (event.key === " " || event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      } else if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, started]);

  function beginReading(fromBeginning: boolean) {
    if (!bundle) return;
    if (fromBeginning) {
      setCurrentIndex(firstReadableIndex(bundle.source));
      safeRemove(progressStorageKey(bundle.source));
      setHasSavedProgress(false);
    }
    unlockAudio();
    setStarted(true);
  }

  function handleReaderClick(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-interactive='true']")) return;
    next();
  }

  if (loadError) return <ErrorScreen message={loadError} />;

  if (!bundle) {
    return (
      <main className="loading-screen">
        <span className="loading-mark" aria-hidden="true" />
        <p>正在装订书页…</p>
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
          hasProgress={hasSavedProgress}
          progress={progress}
          onContinue={() => beginReading(false)}
          onRestart={() => beginReading(true)}
        />
      ) : (
        <>
          <header className="reader-header" data-interactive="true">
            <div className="book-mark">
              <span className="book-mark__label">正在阅读</span>
              <span className="book-mark__title">{bundle.source.title}</span>
            </div>
            <div className="scene-mark" aria-live="polite">
              <span>第 {sceneNumber} 幕</span>
              <strong>{activeScene ? sceneNames[activeScene.id] ?? activeScene.location : ""}</strong>
            </div>
            <button
              className="icon-button"
              type="button"
              data-interactive="true"
              aria-label="阅读设置"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <span aria-hidden="true">Aa</span>
            </button>
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
                return (
                  <div
                    className={`paragraph paragraph--${paragraph.kind}${index === visibleParagraphs.length - 1 ? " is-current" : ""}`}
                    key={paragraph.id}
                    ref={index === visibleParagraphs.length - 1 ? latestParagraphRef : undefined}
                    data-paragraph-id={paragraph.id}
                  >
                    {lines.map((line, lineIndex) => (
                      <span key={`${paragraph.id}-${lineIndex}`}>
                        {line}
                        {lineIndex < lines.length - 1 ? <br /> : null}
                      </span>
                    ))}
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
          {audioError ? <div className="audio-notice">{audioError}，已继续纯文本阅读。</div> : null}
          <div className="advance-hint" aria-hidden="true">点击空白处或按空格继续</div>
        </>
      )}
    </main>
  );
}

interface CoverScreenProps {
  title: string;
  hasProgress: boolean;
  progress: number;
  onContinue: () => void;
  onRestart: () => void;
}

function CoverScreen({ title, hasProgress, progress, onContinue, onRestart }: CoverScreenProps) {
  return (
    <section className="cover-screen">
      <p className="cover-kicker">沉浸阅读实验 · 手工导演版</p>
      <h1>{title}</h1>
      <p className="cover-summary">原书负责说什么，导演只决定怎么呈现。</p>
      <div className="cover-actions">
        <button className="primary-action" type="button" onClick={onContinue}>
          {hasProgress ? `继续阅读 · ${Math.round(progress)}%` : "开始阅读"}
          <span aria-hidden="true">→</span>
        </button>
        {hasProgress ? <button className="text-action" type="button" onClick={onRestart}>从头开始</button> : null}
      </div>
      <p className="cover-note">开始后将播放低音量环境声，可随时静音或切换纯净模式。</p>
    </section>
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

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="error-screen">
      <p className="error-screen__code">BOOK_LOAD_FAILED</p>
      <h1>书页没有装订成功</h1>
      <p>{message}</p>
      <code>cd /Users/empathy/Jade<br />direnv exec . just dev</code>
      <p className="error-screen__hint">请通过开发服务器访问 http://localhost:5173</p>
    </main>
  );
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
