"""Command-line interface for deterministic TXT and EPUB import."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Sequence

from immersive_reader.epub_importing import import_epub
from immersive_reader.importing import BookImportError, SUPPORTED_ENCODINGS, import_txt


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="immersive-reader-import",
        description="Import an immutable TXT or EPUB into a deterministic source.json.",
    )
    parser.add_argument("input", type=Path, help="TXT or EPUB file to import")
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="book bundle directory that will contain the frozen source and source.json",
    )
    parser.add_argument(
        "--book-id",
        required=True,
        help="stable lowercase identifier, for example my-novel",
    )
    parser.add_argument("--revision", type=int, default=1)
    parser.add_argument("--title", default=None, help="override the metadata title")
    parser.add_argument(
        "--language",
        default=None,
        help="override language metadata (TXT default: zh-CN; EPUB default: package metadata)",
    )
    parser.add_argument(
        "--encoding",
        default="auto",
        choices=("auto", *SUPPORTED_ENCODINGS),
        help="input encoding (default: detect UTF BOM, UTF-8, then GB18030)",
    )
    parser.add_argument(
        "--first-block-is-title",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="classify the first non-empty block as the book title (default: true)",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        suffix = args.input.suffix.lower()
        if suffix == ".txt":
            result = import_txt(
                args.input,
                args.output,
                book_id=args.book_id,
                revision=args.revision,
                title=args.title,
                language=args.language or "zh-CN",
                encoding=args.encoding,
                first_block_is_title=args.first_block_is_title,
            )
        elif suffix == ".epub":
            if args.encoding != "auto":
                raise BookImportError("--encoding only applies to TXT input")
            result = import_epub(
                args.input,
                args.output,
                book_id=args.book_id,
                revision=args.revision,
                title=args.title,
                language=args.language,
            )
        else:
            raise BookImportError(
                f"input must use a supported .txt or .epub extension: {args.input}"
            )
    except (OSError, BookImportError) as error:
        print(f"Import failed: {error}", file=sys.stderr)
        return 1

    format_description = result.encoding or "EPUB spine"
    print(
        f"Imported {result.paragraph_count} paragraphs as {format_description}: "
        f"{result.manifest_path}"
    )
    print(f"Source SHA-256: {result.sha256}")
    return 0


def entrypoint() -> None:
    raise SystemExit(main())


if __name__ == "__main__":
    entrypoint()
