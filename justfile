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

# Run all current checks. `pnpm check` already lints the TypeScript side,
# so only ruff is added here rather than a second eslint pass.
check:
    uv run --project pipeline --frozen ruff check pipeline scripts
    pnpm check
    just validate
    just validate-library
    just validate-local
    uv run --project pipeline --frozen pytest

# Lint both languages.
lint:
    pnpm lint
    uv run --project pipeline --frozen ruff check pipeline scripts

# Apply every lint fix that is safe to apply automatically.
lint-fix:
    pnpm lint --fix
    uv run --project pipeline --frozen ruff check --fix pipeline scripts

# Run all current automated tests.
test:
    pnpm test
    uv run --project pipeline --frozen pytest

# Pin every catalogued asset's bytes by recording its sha256 in assets.json.
hash-assets bundle:
    uv run --project pipeline --frozen immersive-reader-hash-assets "{{bundle}}"

# Validate a source/direction/assets/playback bundle.
validate bundle="tests/fixtures/valid":
    uv run --project pipeline --frozen immersive-reader-validate "{{bundle}}"

# Validate the book library and every registered bundle.
validate-library library="books/library.json":
    uv run --project pipeline --frozen immersive-reader-validate-library "{{library}}"

# Validate the private local shelf when one exists (books/library.local.json is
# never tracked, so CI has nothing to validate here).
validate-local:
    @if [ -f books/library.local.json ]; then         uv run --project pipeline --frozen immersive-reader-validate-library books/library.local.json;     else         echo "No private shelf (books/library.local.json); skipping.";     fi

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
