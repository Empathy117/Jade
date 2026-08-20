# ADR-0002: Compile EPUB into the unified immutable source contract

**Status:** Accepted
**Date:** 2026-08-20
**Deciders:** Project owner

## Context

The second production book will be an EPUB. The Reader currently consumes a
normalized `source.json` plus Agent-authored direction, assets, and playback.
There are two plausible ways to add EPUB:

1. render the EPUB directly in the browser with an EPUB runtime such as
   epub.js, then attach presentation behavior to its DOM; or
2. parse the EPUB at build time and compile its reading order and textual
   blocks into the existing immutable source contract.

The product intentionally replaces a book's visual presentation while
preserving its words. Maintaining EPUB layout, CSS, pagination, scripting, and
Reader Runtime behavior simultaneously would create a second rendering system
and weaken paragraph-ID guarantees.

## Decision

Compile EPUB at build time into the same `source.json` used by TXT books.

```text
source.epub (unchanged bytes + SHA-256)
    -> META-INF/container.xml
    -> OPF metadata + manifest + spine
    -> ordered XHTML textual blocks
    -> source.json with stable paragraph IDs
    -> unchanged Agent production and Reader Runtime
```

The importer will:

- preserve the original EPUB bytes as `source.epub`;
- locate the package document through `META-INF/container.xml`;
- follow OPF spine order rather than ZIP member or filename order;
- read title, language, and creators from package metadata;
- extract headings, paragraphs, block quotes, lists, and preformatted blocks;
- normalize layout whitespace without rewriting the archived EPUB;
- ignore CSS, scripts, embedded fonts, original pagination, and non-spine
  resources for the first version;
- reject malformed containers, unresolved spine items, unsafe paths, and
  unreasonably large packages with actionable errors;
- generate the existing source identity and paragraph IDs so downstream
  contracts remain unchanged.

## Options considered

### A. Browser-native EPUB rendering

| Dimension | Assessment |
|---|---|
| Layout fidelity | High |
| Runtime complexity | High |
| Paragraph identity | Difficult |
| Reuse of existing Reader | Low |

**Pros:** Preserves publisher styling, navigation, pagination, and embedded
media.

**Cons:** Creates two text rendering systems, complicates incremental reveal
and history, and makes stable paragraph references dependent on EPUB DOM
details.

### B. Build-time unified import

| Dimension | Assessment |
|---|---|
| Layout fidelity | Intentionally low |
| Runtime complexity | Low |
| Paragraph identity | Strong |
| Reuse of existing Reader | Complete |

**Pros:** Preserves the current architecture, keeps the Runtime deterministic,
and allows Agent and future automation to treat TXT and EPUB identically.

**Cons:** Drops original visual layout and initially omits footnote linking,
tables, ruby semantics, and embedded illustrations.

### C. Maintain both modes

| Dimension | Assessment |
|---|---|
| Feature coverage | High |
| Complexity | Very high |
| Consistency | Low |

**Pros:** Could choose fidelity or immersion per book.

**Cons:** Doubles testing and creates ambiguous progress, direction, and
playback semantics. Deferred unless real books prove unified import inadequate.

## Consequences

- TXT and EPUB share one Importer command and one downstream production flow.
- `source.json` may include optional creator metadata, while paragraph text and
  source identity remain authoritative.
- EPUB-specific source locations are not exposed to Runtime in the first
  version; paragraph IDs are the canonical reading positions.
- Original EPUB images are not automatically treated as Reader backgrounds.
- A future epub.js fallback is permitted only for books whose meaning depends
  on layout and only after an explicit architecture review.

## Action items

1. [ ] Implement safe EPUB container and package parsing.
2. [ ] Extract spine XHTML blocks into deterministic paragraphs.
3. [ ] Extend the unified import command and tests.
4. [ ] Update the Agent production protocol for EPUB inputs.
5. [ ] Produce the second book from a real user-provided EPUB.
