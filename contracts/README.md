# Data contracts

The files in this directory are the language-neutral boundary between the
build-time pipeline and the Reader Runtime. They use JSON Schema Draft 2020-12.

## Versioning

Every document has an integer `schema_version`. Version `1` is the first public
contract for the prototype.

- Additive optional fields do not require a version change.
- Removing a field, changing its meaning, narrowing accepted values, or making
  an optional field required increments `schema_version`.
- Readers and pipeline commands must reject unsupported versions instead of
  guessing how to interpret them.
- A migration creates a new document; it never rewrites an immutable source
  revision in place.

`direction` and `playback` accept versions `1` and `2` in one schema file
([ADR-0004](../docs/adr/0004-reading-driven-camera-and-moments.md)). Version 2
adds shots, key moments, and grade tokens; a version-1 document that carries
any of them is rejected. The framing metadata on background assets
(`focal_points`, `text_safe_area`, `min_scale_headroom`) is optional and
additive, so `assets` stays at version 1.

The validator enforces the v2 cross-document rules: shots stay inside their
scene, a shot's `focus` names a focal point on the background showing there,
camera scale stays within that background's `min_scale_headroom` (1.2 when
unrecorded), playback moments mirror directed moments, and the ADR-0004
restraint budget holds.

Version 2 also carries the opt-in `visual_novel` profile
([ADR-0005](../docs/adr/0005-visual-novel-presentation-profile.md)): per-scene
`layout` and `atmosphere`, beat-anchored `sounds` and `effects`, CG spans
(`cgs`), `iris`/`wipe` transitions, instrument spans such as the radio
([ADR-0006](../docs/adr/0006-instrument-channel.md)), the wind
([ADR-0008](../docs/adr/0008-wind-instrument.md)), the letter
([ADR-0009](../docs/adr/0009-letter-instrument.md)), the pianola
([ADR-0010](../docs/adr/0010-pianola-instrument.md)), and incense
([ADR-0011](../docs/adr/0011-incense-instrument.md)), and gesture beats such as
grinding ink ([ADR-0007](../docs/adr/0007-gesture-beats.md)) and carving wood
([ADR-0012](../docs/adr/0012-carve-wood-gesture.md)). Assets gain the
`cg` and `sfx` types.

Playback v2 semantics the Compiler must honour:

- Camera `x` and `y` run from -1 to 1 within the slack the scale leaves; at
  `x: 1` the image's right edge meets the viewport's. Keys interpolate by
  reading position and never across a background cue.
- A grade stays in force until the next cue grade or `grade_shift`; emit a
  grade with `shade: 0` to return a scene to the ungraded plate.
- Instrument keys hold until the next key, except an `incense` key's
  `burnt`, which interpolates by reading position while the stick is lit.

The `$id` of each schema still carries the `/v1/` path of the first contract.
A document's version is its `schema_version`; `direction` and `playback`
accept 1 and 2 in the same file. The repository keeps older schemas while any
stored book still depends on them.

## Documents

- `source.schema.json`: immutable imported text, source identity, and optional
  anchored source illustrations.
- `direction.schema.json`: semantic scene analysis with no copied prose and no
  concrete asset selection.
- `assets.schema.json`: available assets, technical metadata, and provenance.
- `playback.schema.json`: resolved paragraph cues consumed by the Runtime.
- `guide.schema.json`: optional preferred narrative start and curated recurring
  references to source illustrations.
- `codex.schema.json`: optional dossier of characters, relationships, family
  trees, places, and maps, each atom anchored at its first textual reveal.
- `library.schema.json`: the tracked and the private book shelves.

JSON Schema validates document shape. Cross-document ordering, references,
hashes, scene coverage, and asset file existence are enforced by the pipeline
validator.

## Integrity

The source text is immutable: `source.json` always carries the `sha256` of the
imported TXT or EPUB and of every extracted illustration, and the validator
fails if those bytes ever change.

Assets are Director-layer material and may legitimately be replaced — a
background can be re-rendered, a track re-encoded — so `assets[].sha256` is
**optional**. When an asset records one, the validator holds it to those exact
bytes; when it does not, only the file's existence is checked. Pin a finished
catalog with:

```sh
just hash-assets books/my-novel
```
