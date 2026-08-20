import type {
  Asset,
  AssetsDocument,
  BookBundle,
  DirectionDocument,
  GuideDocument,
  LibraryBook,
  LibraryDocument,
  PlaybackDocument,
  SourceDocument,
  SourceIllustration,
} from "./types";

export const LIBRARY_URL = "/library.json";

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
  return (await response.json()) as T;
}

export async function loadLibrary(): Promise<LibraryDocument> {
  return fetchJson<LibraryDocument>(LIBRARY_URL);
}

export async function loadBookBundle(book: LibraryBook): Promise<BookBundle> {
  const baseUrl = bookBaseUrl(book.path);
  const [source, direction, assets, playback, guide] = await Promise.all([
    fetchJson<SourceDocument>(`${baseUrl}/source.json`),
    fetchJson<DirectionDocument>(`${baseUrl}/direction.json`),
    fetchJson<AssetsDocument>(`${baseUrl}/assets.json`),
    fetchJson<PlaybackDocument>(`${baseUrl}/playback.json`),
    fetchOptionalJson<GuideDocument>(`${baseUrl}/guide.json`),
  ]);
  return { source, direction, assets, playback, guide };
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
