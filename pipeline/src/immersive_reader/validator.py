"""Command-line interface for Reader bundle validation."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from immersive_reader.validation import validate_bundle


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="immersive-reader-validate",
        description="Validate a source/direction/assets/playback bundle.",
    )
    parser.add_argument(
        "bundle",
        type=Path,
        help="directory containing source.json, direction.json, assets.json, and playback.json",
    )
    parser.add_argument(
        "--contracts",
        type=Path,
        default=None,
        help="directory containing the four JSON Schema files (default: ./contracts)",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    issues = validate_bundle(args.bundle, contracts_dir=args.contracts)
    if issues:
        print(f"Validation failed with {len(issues)} issue(s):", file=sys.stderr)
        for issue in issues:
            print(f"- {issue}", file=sys.stderr)
        return 1

    print(f"Validated bundle: {args.bundle.resolve()}")
    return 0


def entrypoint() -> None:
    raise SystemExit(main())


if __name__ == "__main__":
    entrypoint()
