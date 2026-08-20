# ADR-0001: Agent-assisted book production with replaceable automation

**Status:** Accepted  
**Date:** 2026-08-20  
**Deciders:** Project owner

## Context

The Reader Runtime has proven useful for the project owner's personal reading.
The immediate need is to make more books, not to build a public upload service.
An Agent can already segment scenes, generate or acquire assets, process audio,
author JSON, and respond to subjective feedback. Reimplementing all of that as
an unattended application now would add substantial work before a sufficiently
large reusable asset catalog or repeated production history exists.

At the same time, unattended book compilation remains desirable: a future user
should be able to upload a book and receive a playable result automatically.
Today's implementation therefore must not couple the Runtime to Agent-specific
behavior.

## Decision

Use an Agent as the first production implementation while keeping the build
artifacts as stable, versioned component boundaries:

```text
source.txt
    -> deterministic Importer -> source.json
    -> Agent Director          -> direction.json
    -> Agent asset production  -> assets.json + asset files
    -> Agent playback author   -> playback.json
    -> validators              -> registered book bundle
    -> Reader Runtime
```

The Agent may reason freely, but it communicates with the Runtime only through
the same contracts that future automated Director, Asset Matcher, and Playback
Compiler components will produce. The Runtime does not call an Agent and does
not infer missing direction.

Automation will be extracted only when repeated book production reveals a
stable rule, or when the shared asset catalog is large enough for reliable
unattended matching. The production log must identify remaining human choices
so those extraction opportunities are visible.

## Options considered

### A. Build unattended automation now

| Dimension | Assessment |
|---|---|
| Immediate personal value | Low to medium |
| Implementation complexity | High |
| Readiness of asset catalog | Low |
| Future scalability | High |

**Pros:** Direct path to upload-and-generate; deterministic and repeatable.

**Cons:** Encodes aesthetic rules from only one completed book, duplicates work
an Agent can already perform, and requires a much larger licensed asset catalog.

### B. Agent-assisted production behind stable contracts

| Dimension | Assessment |
|---|---|
| Immediate personal value | High |
| Implementation complexity | Low to medium |
| Readiness of asset catalog | Sufficient |
| Future scalability | Preserved through contracts |

**Pros:** Produces new books now, keeps subjective feedback in the loop, and
collects the examples needed for later automation.

**Cons:** Each book currently requires Agent time and some owner judgment;
results are not yet fully reproducible from the TXT alone.

### C. Hand-author every book without a protocol

| Dimension | Assessment |
|---|---|
| Immediate personal value | Medium |
| Implementation complexity | Low |
| Consistency | Low |
| Future scalability | Low |

**Pros:** Minimal infrastructure.

**Cons:** Repeats mistakes, loses provenance, and does not create a clean path
to automation.

## Consequences

- A reusable Agent production protocol and a book library become immediate
  product features.
- `source.json`, `direction.json`, `assets.json`, and `playback.json` remain the
  mandatory interface; no Agent-only shortcuts may bypass them.
- Scene and asset labels may carry optional display metadata, but semantic IDs
  and source identity remain authoritative.
- Subjective choices stay with the Agent and owner until repetition justifies
  code.
- Public upload, embedded model calls, a general Matcher, and a server remain
  deferred rather than rejected.
- Before public release, the multi-reader experience gate and unattended output
  quality evaluation must be restored.

## Automation triggers

Reconsider an automated component when at least one condition holds:

1. The same manual decision recurs across three or more produced books.
2. The shared catalog covers common locations, moods, weather, and music states
   well enough that missing assets are exceptional.
3. Agent production time becomes the main reason a new book is not created.
4. The product is prepared for use by people who cannot invoke the Agent.

## Action items

1. [x] Keep the deterministic TXT Importer.
2. [x] Define the standard Agent book-production protocol.
3. [ ] Add and validate `books/library.json`.
4. [ ] Let the Runtime select any registered book.
5. [ ] Produce a second real book and record manual intervention.
6. [ ] Revisit Matcher and Compiler extraction using the production logs.
