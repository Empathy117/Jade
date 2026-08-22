# Immersive Reader Pipeline

This package contains build-time tools for the importer, director, matcher, and
playback compiler.

Phase 5 provides a deterministic TXT and EPUB importer:

```sh
immersive-reader-import novel.txt \
  --output books/my-novel \
  --book-id my-novel
```

The importer preserves the original bytes as `source.txt`, records their
SHA-256, detects UTF BOMs, UTF-8, or GB18030, and creates stable sequential
paragraph IDs. Blank lines delimit text blocks; the first block is the title by
default. Use `--no-first-block-is-title --title "Book title"` when the input
starts directly with prose. An existing output directory is only reused when
its immutable source identity matches.

EPUB uses the same command. It preserves `source.epub`, follows the OPF spine,
reads package metadata, extracts ordered XHTML blocks into the same
`source.json` contract, and preserves supported anchored raster illustrations
under `source-assets/` with hashes and paragraph anchors:

```sh
immersive-reader-import novel.epub \
  --output books/my-epub \
  --book-id my-epub
```

If an EPUB keeps producer notes or other apparatus in its linear spine without
semantic markup, preserve those blocks while removing them from the Reader's
linear flow by naming each archive document explicitly:

```sh
immersive-reader-import novel.epub \
  --output books/my-epub \
  --book-id my-epub \
  --epub-note-document Text/producer-notes.xhtml
```

The option is repeatable and does not alter the frozen EPUB bytes or paragraph
order; it only classifies the selected document's readable blocks as notes.
For editions whose footnotes use a publisher-specific CSS class instead, pass
that class token with repeatable `--epub-note-class` options.

With explicit authorization, a document proven to be unrelated acquisition
paratext (for example a download-site advertisement or donation page) can be
left out of `source.json` with repeatable `--epub-skip-document` options. The
original document remains byte-for-byte present in the frozen `source.epub`;
never use this option for copyright pages, dedications, tables of contents,
author or translator notes, illustrations, or genuine book appendices.

Phase 2 provides the first tool, a bundle validator:

```sh
immersive-reader-validate tests/fixtures/valid
```

It validates the four required JSON Schema documents, optional `guide.json`,
and cross-document invariants such as source identity, scene coverage,
paragraph order, source illustration hashes, guide references, asset
references, asset types, file existence, and the raw source SHA-256.

The library validator checks `books/library.json`, cross-checks every entry with
its `source.json`, verifies the cover, and runs the complete bundle validator
for every registered book:

```sh
immersive-reader-validate-library books/library.json
```
