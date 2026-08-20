/** Full-page states the Reader shows instead of a book. */

interface ErrorScreenProps {
  message: string;
  onBack?: () => void;
}

export function ErrorScreen({ message, onBack }: ErrorScreenProps) {
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
      <code>cd &lt;项目目录&gt;<br />direnv exec . just dev</code>
      <p className="error-screen__hint">请通过开发服务器访问 http://localhost:5173</p>
    </main>
  );
}

export function LoadingScreen({ message }: { message: string }) {
  return (
    <main className="loading-screen">
      <span className="loading-mark" aria-hidden="true" />
      <p>{message}</p>
    </main>
  );
}
