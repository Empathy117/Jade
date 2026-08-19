set dotenv-load := false

default: check

# Start the Reader development server.
dev:
    pnpm --filter @immersive-reader/reader dev

# Run all Phase 1 checks.
check:
    pnpm check
    uv run --project pipeline --frozen pytest

# Run all current automated tests.
test:
    pnpm test
    uv run --project pipeline --frozen pytest

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
