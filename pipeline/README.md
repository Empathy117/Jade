# Immersive Reader Pipeline

This package contains build-time tools for the importer, director, matcher, and
playback compiler.

Phase 2 provides the first tool, a bundle validator:

```sh
immersive-reader-validate tests/fixtures/valid
```

It validates the four JSON Schema documents and cross-document invariants such
as source identity, scene coverage, paragraph order, asset references, asset
types, file existence, and the raw source SHA-256.
