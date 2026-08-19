set dotenv-load := false

default: check

# Start the Reader development server.
dev:
    pnpm --filter @immersive-reader/reader dev

# Run all current checks.
check:
    pnpm check
    just validate
    uv run --project pipeline --frozen pytest

# Run all current automated tests.
test:
    pnpm test
    uv run --project pipeline --frozen pytest

# Validate a source/direction/assets/playback bundle.
validate bundle="tests/fixtures/valid":
    uv run --project pipeline --frozen immersive-reader-validate "{{bundle}}"

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
