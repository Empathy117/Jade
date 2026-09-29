interface CoverScreenProps {
  title: string;
  author: string | null;
  summary: string;
  hasProgress: boolean;
  hasPreferredStart: boolean;
  progress: number;
  onContinue: () => void;
  onStartPreferred: () => void;
  onStartBeginning: () => void;
  onLibrary: () => void;
}

export function CoverScreen({
  title,
  author,
  summary,
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
      {author ? <p className="cover-kicker">{author}</p> : null}
      <h1>{title}</h1>
      {summary ? <p className="cover-summary">{summary}</p> : null}
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
