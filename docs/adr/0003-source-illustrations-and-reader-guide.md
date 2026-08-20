# ADR-0003: Preserve source illustrations and expose an optional Reader Guide

**Status:** Accepted
**Date:** 2026-08-20
**Deciders:** Project owner

## Context

The first real EPUB trial, 山口雅也《生尸之死》, contains three diagrams that
carry story information: a family tree, a cemetery map, and a funeral-home
floor plan. The EPUB importer currently preserves only textual blocks, so the
Reader retains their headings or captions but silently drops the images.

These images are not AI presentation assets. They are part of what the source
book says and therefore belong to the immutable source layer. At the same time,
not every source illustration deserves a permanent shortcut: a mystery reader
may repeatedly consult a family tree, while decorative chapter art in another
book should simply appear inline.

The same trial also contains 112 paragraphs of copyright, contents, cast, and
other front matter before the narrative begins. The source must retain them,
but the Reader needs a book-specific preferred starting point.

## Decision

Separate three responsibilities:

1. **Importer / `source.json`** preserves every supported image referenced by
   spine XHTML. Each illustration records a stable ID, source-relative path,
   media type, hash, title, and paragraph anchor. Extracted bytes live under
   `source-assets/` and are validated as immutable source content.
2. **Optional `guide.json`** contains book-specific reading aids. It may define
   a preferred `start_at` paragraph and select a subset of source illustration
   IDs for a persistent reference gallery.
3. **Reader Runtime** renders every source illustration at its original anchor.
   When a guide selects reference items, the Reader also exposes a dedicated
   “资料图册” module with thumbnails, a large view, and access from any reading
   position.

```text
source.epub
  -> source.json.illustrations[]
  -> source-assets/illustration-0001.jpeg

guide.json
  -> start_at: p0114
  -> references[]: selected illustration IDs

Reader
  -> inline source illustration
  -> optional persistent 资料图册
```

`guide.json` is optional. TXT books and EPUBs without recurring reference
material continue to use the existing four-document bundle unchanged.

## Options considered

### A. Treat EPUB images as Director backgrounds

| Dimension | Assessment |
|---|---|
| Implementation effort | Low |
| Source fidelity | Low |
| Readability of diagrams | Low |
| Architectural separation | Poor |

**Pros:** Reuses the existing asset and playback system.

**Cons:** Darkening, cropping, and crossfading a family tree changes source
content into decoration. It also makes diagrams difficult to inspect and loses
their original reading position.

### B. Put all EPUB images in a global gallery

| Dimension | Assessment |
|---|---|
| Implementation effort | Medium |
| Source fidelity | Medium |
| Per-book curation | None |
| Decorative-image noise | High |

**Pros:** Every image is recoverable and can be revisited.

**Cons:** Cover art, ornaments, and one-off illustrations would clutter the
gallery. Their original inline position would still be missing.

### C. Preserve all inline, curate recurring references separately

| Dimension | Assessment |
|---|---|
| Implementation effort | Medium |
| Source fidelity | High |
| Per-book curation | Explicit |
| Reuse for future aids | High |

**Pros:** Keeps source and presentation responsibilities clear, loses no
supported source image, and gives mystery books a focused reference surface.

**Cons:** Adds one optional contract and requires image extraction, validation,
and responsive viewer behavior.

## Consequences

- The phrase “原书负责说什么” now includes information-bearing illustrations,
  not text alone.
- Paragraph IDs remain stable because illustrations are anchored metadata, not
  inserted paragraph records.
- A guide can evolve later to include character cards, glossaries, or location
  indexes without changing Director or playback contracts.
- EPUB SVG, video, interactive media, and publisher layout remain unsupported;
  the first implementation accepts browser-safe raster image types only.
- Changing guide curation does not change the immutable source document.

## Action items

1. [ ] Extract supported spine images into deterministic `source-assets/` paths.
2. [ ] Extend source schema and validation for immutable illustrations.
3. [ ] Add optional `guide.json` schema and cross-document validation.
4. [ ] Build inline illustration and reference-gallery Reader components.
5. [ ] Configure the three reference diagrams and narrative start for
       《生尸之死》.
6. [ ] Add importer, validator, state, build, and browser tests.
