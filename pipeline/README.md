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
reads package metadata, and extracts ordered XHTML blocks into the same
`source.json` contract:

```sh
immersive-reader-import novel.epub \
  --output books/my-epub \
  --book-id my-epub
```

Phase 2 provides the first tool, a bundle validator:

```sh
immersive-reader-validate tests/fixtures/valid
```

It validates the four JSON Schema documents and cross-document invariants such
as source identity, scene coverage, paragraph order, asset references, asset
types, file existence, and the raw source SHA-256.

The library validator checks `books/library.json`, cross-checks every entry with
its `source.json`, verifies the cover, and runs the complete bundle validator
for every registered book:

```sh
immersive-reader-validate-library books/library.json
```
