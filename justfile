set dotenv-load := false

default: check

# Start the Reader development server.
dev:
    pnpm --filter @immersive-reader/reader dev

# Rebuild the immutable source manifest for the hand-authored demo.
demo-source:
    uv run --project pipeline --frozen python scripts/build_demo_source.py

# Import a TXT file into an immutable source bundle.
import-txt input output book_id revision="1":
    uv run --project pipeline --frozen immersive-reader-import "{{input}}" --output "{{output}}" --book-id "{{book_id}}" --revision "{{revision}}"

# Import a TXT or EPUB into an immutable source bundle.
import-book input output book_id revision="1":
    uv run --project pipeline --frozen immersive-reader-import "{{input}}" --output "{{output}}" --book-id "{{book_id}}" --revision "{{revision}}"

# Run all current checks.
check:
    pnpm check
    just validate
    just validate-library
    uv run --project pipeline --frozen pytest

# Run all current automated tests.
test:
    pnpm test
    uv run --project pipeline --frozen pytest

# Validate a source/direction/assets/playback bundle.
validate bundle="tests/fixtures/valid":
    uv run --project pipeline --frozen immersive-reader-validate "{{bundle}}"

# Validate the book library and every registered bundle.
validate-library library="books/library.json":
    uv run --project pipeline --frozen immersive-reader-validate-library "{{library}}"

# Print the toolchain selected by the flake.
versions:
    @nix --version
    @direnv version
    @node --version
    @pnpm --version
    @python --version
    @uv --version
    @just --version
    @jq --version
