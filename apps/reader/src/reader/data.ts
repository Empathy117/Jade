import type {
  Asset,
  AssetsDocument,
  BookBundle,
  CodexDocument,
  DirectionDocument,
  GuideDocument,
  LibraryBook,
  LibraryDocument,
  PlaybackDocument,
  SourceDocument,
  SourceIllustration,
} from "./types";

export const LIBRARY_URL = "/library.json";
/**
 * The private shelf: same schema, never committed to the repository, so books
 * that must not be redistributed can still sit beside the tracked demo.
 */
export const LOCAL_LIBRARY_URL = "/library.local.json";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法加载 ${url}（HTTP ${response.status}）`);
  }
  return (await response.json()) as T;
}

async function fetchOptionalJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`无法加载 ${url}（HTTP ${response.status}）`);
  }
  // A dev server or static host with an SPA fallback answers a missing file
  // with 200 and the index page, so absence is decided by content type too —
  // otherwise a book that simply has no guide fails to open at all.
  if (!isJsonResponse(response)) return null;
  return (await response.json()) as T;
}

function isJsonResponse(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("json");
}

export async function loadLibrary(): Promise<LibraryDocument> {
  const [tracked, local] = await Promise.all([
    fetchJson<LibraryDocument>(LIBRARY_URL),
    fetchOptionalJson<LibraryDocument>(LOCAL_LIBRARY_URL),
  ]);
  return mergeLibraries(tracked, local);
}

/** Tracked books first; a local entry with the same id overrides its double. */
export function mergeLibraries(
  tracked: LibraryDocument,
  local: LibraryDocument | null,
): LibraryDocument {
  if (!local?.books.length) return tracked;
  const localIds = new Set(local.books.map((book) => book.book_id));
  return {
    ...tracked,
    books: [
      ...tracked.books.filter((book) => !localIds.has(book.book_id)),
      ...local.books,
    ],
  };
}

export async function loadBookBundle(book: LibraryBook): Promise<BookBundle> {
  const baseUrl = bookBaseUrl(book.path);
  const [source, direction, assets, playback, guide, codex] = await Promise.all([
    fetchJson<SourceDocument>(`${baseUrl}/source.json`),
    fetchJson<DirectionDocument>(`${baseUrl}/direction.json`),
    fetchJson<AssetsDocument>(`${baseUrl}/assets.json`),
    fetchJson<PlaybackDocument>(`${baseUrl}/playback.json`),
    fetchOptionalJson<GuideDocument>(`${baseUrl}/guide.json`),
    fetchOptionalJson<CodexDocument>(`${baseUrl}/codex.json`),
  ]);
  return { source, direction, assets, playback, guide, codex };
}

export function bookBaseUrl(bookPath: string): string {
  return `/${encodePath(bookPath)}`;
}

export function assetUrl(bookPath: string, asset: Asset): string {
  return bookFileUrl(bookPath, asset.path);
}

export function sourceIllustrationUrl(
  bookPath: string,
  illustration: SourceIllustration,
): string {
  return bookFileUrl(bookPath, illustration.path);
}

export function bookFileUrl(bookPath: string, path: string): string {
  return `${bookBaseUrl(bookPath)}/${encodePath(path)}`;
}

export function coverUrl(book: LibraryBook): string {
  return `${bookBaseUrl(book.path)}/${encodePath(book.cover)}`;
}

export function findLibraryBook(
  library: LibraryDocument,
  requested: string | null,
): LibraryBook | null {
  if (!requested) return null;
  return (
    library.books.find(
      (book) => book.path === requested || book.book_id === requested,
    ) ?? null
  );
}

export function indexAssets(document: AssetsDocument): Map<string, Asset> {
  return new Map(document.assets.map((asset) => [asset.id, asset]));
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
