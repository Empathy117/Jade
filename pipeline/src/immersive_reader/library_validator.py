"""Command-line interface for Reader library validation."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from immersive_reader.library_validation import validate_library


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="immersive-reader-validate-library",
        description="Validate books/library.json and every registered book bundle.",
    )
    parser.add_argument("library", type=Path, help="path to books/library.json")
    parser.add_argument(
        "--contracts",
        type=Path,
        default=None,
        help="directory containing JSON Schema files (default: ./contracts)",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    issues = validate_library(args.library, contracts_dir=args.contracts)
    if issues:
        print(f"Library validation failed with {len(issues)} issue(s):", file=sys.stderr)
        for issue in issues:
            print(f"- {issue}", file=sys.stderr)
        return 1

    print(f"Validated library: {args.library.resolve()}")
    return 0


def entrypoint() -> None:
    raise SystemExit(main())


if __name__ == "__main__":
    entrypoint()
