import { appMetadata } from "./appMetadata";

export function App() {
  return (
    <main className="shell">
      <section className="status-card" aria-labelledby="app-title">
        <p className="eyebrow">{appMetadata.phase}</p>
        <h1 id="app-title">{appMetadata.name}</h1>
        <p className="summary">
          可复现开发环境已经就绪。Reader 功能将在数据契约确定后开始实现。
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" />
          Workspace ready
        </div>
      </section>
    </main>
  );
}
