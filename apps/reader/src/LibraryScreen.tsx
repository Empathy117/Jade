import { coverUrl } from "./reader/data";
import type { ShelfEntry } from "./reader/shelf";
import type { LibraryBook } from "./reader/types";

interface LibraryScreenProps {
  /** Every book, most recently read first. */
  entries: ShelfEntry[];
  onSelect: (book: LibraryBook) => void;
}

export function LibraryScreen({ entries, onSelect }: LibraryScreenProps) {
  // The book the reader was last inside leads the page; the rest line the shelf.
  const recent = entries.find((entry) => entry.continued) ?? null;
  const shelf = recent ? entries.filter((entry) => entry !== recent) : entries;

  return (
    <main className="library-screen">
      <div className="library-glow" aria-hidden="true" />
      <header className="library-header">
        <div className="library-brand">
          <span className="library-brand__mark" aria-hidden="true">J</span>
          <strong>Jade Reader</strong>
        </div>
        <span className="library-count">{entries.length} 本藏书</span>
      </header>

      <div className="library-content">
        {recent ? (
          <>
            <h1 className="visually-hidden">书库</h1>
            <RecentBook entry={recent} onSelect={onSelect} />
          </>
        ) : (
          <section className="library-welcome">
            <p className="library-kicker">私人沉浸书库</p>
            <h1>选择一本书，<br />进入它的世界。</h1>
          </section>
        )}

        {shelf.length > 0 ? (
          <section className="library-shelf" aria-label="书架">
            {recent ? <h2 className="library-section-title">书架</h2> : null}
            <div className="book-grid">
              {shelf.map((entry) => (
                <BookCard key={entry.book.book_id} entry={entry} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function RecentBook({
  entry,
  onSelect,
}: {
  entry: ShelfEntry;
  onSelect: (book: LibraryBook) => void;
}) {
  const { book, percent } = entry;
  return (
    <button
      className="recent-book"
      type="button"
      onClick={() => onSelect(book)}
      aria-label={`继续阅读《${book.title}》`}
    >
      <span
        className="recent-book__art"
        style={{ backgroundImage: `url(${coverUrl(book)})` }}
        aria-hidden="true"
      />
      <span className="recent-book__shade" aria-hidden="true" />
      <span className="recent-book__body">
        <span className="library-kicker">上次读到</span>
        <span className="recent-book__title">{book.title}</span>
        {book.author ? <span className="recent-book__author">{book.author}</span> : null}
        <span className="recent-book__foot">
          {percent !== null ? <ProgressMeter percent={percent} /> : null}
          <span className="recent-book__action">
            继续阅读<span aria-hidden="true">→</span>
          </span>
        </span>
      </span>
    </button>
  );
}

function BookCard({
  entry,
  onSelect,
}: {
  entry: ShelfEntry;
  onSelect: (book: LibraryBook) => void;
}) {
  const { book, continued, percent } = entry;
  return (
    <button
      className="book-card"
      type="button"
      onClick={() => onSelect(book)}
      aria-label={`${continued ? "继续" : "开始"}阅读《${book.title}》`}
    >
      <span
        className="book-card__cover"
        style={{ backgroundImage: `url(${coverUrl(book)})` }}
        aria-hidden="true"
      >
        <span className="book-card__shade" />
        <span className="book-card__title">{book.title}</span>
      </span>
      <span className="book-card__body">
        {/* On a phone the cover shrinks to a thumbnail and the title moves here. */}
        <span className="book-card__heading" aria-hidden="true">{book.title}</span>
        <span className="book-card__meta">{book.author ?? "作者未署名"}</span>
        <span className="book-card__summary">{book.summary}</span>
        <span className="book-card__action">
          {continued && percent !== null ? (
            <ProgressMeter percent={percent} />
          ) : (
            <span>{continued ? "继续阅读" : "开始阅读"}</span>
          )}
          <span className="book-card__arrow" aria-hidden="true">→</span>
        </span>
      </span>
    </button>
  );
}

function ProgressMeter({ percent }: { percent: number }) {
  const rounded = Math.round(percent);
  return (
    <span className="progress-meter">
      <span className="progress-meter__track" aria-hidden="true">
        <span className="progress-meter__fill" style={{ width: `${rounded}%` }} />
      </span>
      <span className="progress-meter__label">已读 {rounded}%</span>
    </span>
  );
}
