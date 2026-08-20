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

The `$id` of each schema includes its major contract version. The repository
keeps older schemas while any stored book still depends on them.

## Documents

- `source.schema.json`: immutable imported text, source identity, and optional
  anchored source illustrations.
- `direction.schema.json`: semantic scene analysis with no copied prose and no
  concrete asset selection.
- `assets.schema.json`: available assets, technical metadata, and provenance.
- `playback.schema.json`: resolved paragraph cues consumed by the Runtime.
- `guide.schema.json`: optional preferred narrative start and curated recurring
  references to source illustrations.

JSON Schema validates document shape. Cross-document ordering, references,
hashes, scene coverage, and asset file existence are enforced by the pipeline
validator.
