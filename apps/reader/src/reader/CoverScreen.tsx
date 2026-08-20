import type { BookProductionMode } from "./types";

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

export function CoverScreen({
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
