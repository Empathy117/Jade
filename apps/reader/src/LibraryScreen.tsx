import { coverUrl } from "./reader/data";
import type { LibraryBook } from "./reader/types";

interface LibraryScreenProps {
  books: LibraryBook[];
  hasProgress: (book: LibraryBook) => boolean;
  onSelect: (book: LibraryBook) => void;
}

const productionLabels: Record<LibraryBook["production"], string> = {
  manual: "手工编排",
  "agent-assisted": "Agent 制作",
  automated: "自动生成",
};

export function LibraryScreen({
  books,
  hasProgress,
  onSelect,
}: LibraryScreenProps) {
  return (
    <main className="library-screen">
      <div className="library-glow" aria-hidden="true" />
      <header className="library-header">
        <div className="library-brand">
          <span className="library-brand__mark" aria-hidden="true">J</span>
          <div>
            <strong>Jade Reader</strong>
            <span>AI Director + Reader Runtime</span>
          </div>
        </div>
        <span className="library-count">{books.length} 本藏书</span>
      </header>

      <section className="library-content" aria-labelledby="library-title">
        <p className="library-kicker">私人沉浸书库</p>
        <h1 id="library-title">选择一本书，<br />进入它的世界。</h1>
        <p className="library-intro">
          原文保持原样，背景与声音只负责呈现。每一本书都拥有独立进度。
        </p>

        <div className="book-grid">
          {books.map((book) => {
            const continued = hasProgress(book);
            return (
              <button
                className="book-card"
                type="button"
                key={book.book_id}
                onClick={() => onSelect(book)}
                aria-label={`${continued ? "继续" : "开始"}阅读《${book.title}》`}
              >
                <span
                  className="book-card__cover"
                  style={{ backgroundImage: `url(${coverUrl(book)})` }}
                  aria-hidden="true"
                >
                  <span className="book-card__shade" />
                  <span className="book-card__production">
                    {productionLabels[book.production]}
                  </span>
                  <span className="book-card__title">{book.title}</span>
                </span>
                <span className="book-card__body">
                  <span className="book-card__meta">
                    {book.author ?? "作者未署名"} · {book.paragraph_count} 段
                  </span>
                  <span className="book-card__summary">{book.summary}</span>
                  <span className="book-card__action">
                    {continued ? "继续阅读" : "开始阅读"}
                    <span aria-hidden="true">→</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
