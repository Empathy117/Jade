import type {
  AssetsDocument,
  CodexDocument,
  DirectionDocument,
  GuideDocument,
  LibraryDocument,
  Paragraph,
  PlaybackDocument,
  SourceDocument,
} from "../reader/types";

const SHA = "0".repeat(64);

export function makeParagraphs(count: number): Paragraph[] {
  return [
    { id: "p0001", kind: "title", text: "测试之书" },
    ...Array.from({ length: count }, (_, offset) => ({
      id: `p${String(offset + 2).padStart(4, "0")}`,
      // Offsets 10, 60, 110, … are chapter headings so the table of contents
      // has something to list, while the first paragraphs stay prose for the
      // reading-flow assertions.
      kind: offset % 50 === 10 ? ("chapter_heading" as const) : ("prose" as const),
      text:
        offset % 50 === 10
          ? `第 ${(offset - 10) / 50 + 1} 章`
          : `第 ${offset + 1} 段正文。`,
    })),
  ];
}

export function makeSource(paragraphCount = 6): SourceDocument {
  return {
    schema_version: 1,
    book_id: "test-book",
    revision: 1,
    title: "测试之书",
    language: "zh-CN",
    source: { format: "txt", path: "source.txt", sha256: SHA },
    paragraphs: makeParagraphs(paragraphCount),
  };
}

export function makeLibrary(paragraphCount = 6): LibraryDocument {
  return {
    schema_version: 1,
    books: [
      {
        book_id: "test-book",
        path: "test-book",
        title: "测试之书",
        author: "无名",
        summary: "一本用于测试的书。",
        cover: "assets/backgrounds/cover.jpg",
        source_revision: 1,
        paragraph_count: paragraphCount + 1,
        production: "agent-assisted",
      },
    ],
  };
}

export function makeBundleDocuments(paragraphCount = 6): {
  source: SourceDocument;
  direction: DirectionDocument;
  assets: AssetsDocument;
  playback: PlaybackDocument;
} {
  const source = makeSource(paragraphCount);
  const last = source.paragraphs[source.paragraphs.length - 1].id;

  return {
    source,
    direction: {
      schema_version: 1,
      book_id: "test-book",
      source_revision: 1,
      source_sha256: SHA,
      scenes: [
        {
          id: "scene_001",
          label: "第一幕",
          start: "p0002",
          end: "p0003",
          location: "书房",
          time: "夜",
          weather: null,
          mood: ["quiet"],
          tension: 0.2,
        },
        {
          id: "scene_002",
          label: "第二幕",
          start: "p0004",
          end: last,
          location: "走廊",
          time: "夜",
          weather: null,
          mood: ["uneasy"],
          tension: 0.4,
        },
      ],
    },
    assets: {
      schema_version: 1,
      catalog_id: "test-assets",
      assets: [
        {
          id: "bg_study",
          type: "background",
          path: "assets/backgrounds/study.jpg",
          tags: ["study"],
          license: "Project asset",
          source: "fixture",
          attribution: null,
        },
      ],
    },
    playback: {
      schema_version: 1,
      book_id: "test-book",
      source_revision: 1,
      source_sha256: SHA,
      asset_catalog_id: "test-assets",
      cues: [
        {
          at: "p0002",
          scene_id: "scene_001",
          background: { asset_id: "bg_study", transition: "crossfade", duration_ms: 800 },
        },
        {
          at: "p0004",
          scene_id: "scene_002",
          clear_text: true,
        },
      ],
    },
  };
}

/**
 * A `fetch` that answers the Reader's bundle requests from memory.
 *
 * `guide.json` and `codex.json` are absent unless passed in, which is the
 * common case and exercises the optional document path.
 */
export function stubBookFetch(
  paragraphCount = 6,
  extras: {
    guide?: GuideDocument;
    codex?: CodexDocument;
    firstProseText?: string;
    /** Replace the generated paragraphs entirely (keep ids `p0002`-based). */
    paragraphs?: Paragraph[];
  } = {},
): typeof fetch {
  const library = makeLibrary(paragraphCount);
  const documents = makeBundleDocuments(paragraphCount);
  if (extras.firstProseText) documents.source.paragraphs[1].text = extras.firstProseText;
  if (extras.paragraphs) documents.source.paragraphs = extras.paragraphs;
  const byUrl = new Map<string, unknown>([
    ["/library.json", library],
    ["/test-book/source.json", documents.source],
    ["/test-book/direction.json", documents.direction],
    ["/test-book/assets.json", documents.assets],
    ["/test-book/playback.json", documents.playback],
  ]);
  if (extras.guide) byUrl.set("/test-book/guide.json", extras.guide);
  if (extras.codex) byUrl.set("/test-book/codex.json", extras.codex);

  return ((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : input.toString();
    const document = byUrl.get(url);
    if (document === undefined) {
      return Promise.resolve(
        new Response(null, { status: 404, statusText: "Not Found" }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(document), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;
}
