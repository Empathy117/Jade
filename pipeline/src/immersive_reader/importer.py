"""Command-line interface for deterministic TXT and EPUB import."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from immersive_reader.epub_importing import import_epub
from immersive_reader.importing import SUPPORTED_ENCODINGS, BookImportError, import_txt


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
        "--glyph-map",
        type=Path,
        default=None,
        help=(
            "EPUB only: JSON file mapping archive image paths to the rare "
            "characters they depict; mapped images are restored into the text "
            "instead of becoming source illustrations"
        ),
    )
    parser.add_argument(
        "--epub-note-document",
        action="append",
        default=[],
        metavar="ARCHIVE_PATH",
        help=(
            "EPUB only: classify every readable block in this spine document "
            "as a note; repeat for producer notes or other preserved apparatus "
            "that should not enter the linear reading flow"
        ),
    )
    parser.add_argument(
        "--epub-note-class",
        action="append",
        default=[],
        metavar="CLASS_TOKEN",
        help=(
            "EPUB only: classify blocks carrying this CSS class token as "
            "notes; repeat when an edition uses several unlabelled footnote classes"
        ),
    )
    parser.add_argument(
        "--epub-skip-document",
        action="append",
        default=[],
        metavar="ARCHIVE_PATH",
        help=(
            "EPUB only: omit this entire spine document from source.json while "
            "keeping it unchanged inside the frozen source.epub; repeat only for "
            "confirmed non-book advertising or acquisition paratext"
        ),
    )
    parser.add_argument(
        "--epub-chapter-map",
        type=Path,
        default=None,
        help=(
            "EPUB only: JSON object mapping archive spine paths to chapter "
            "titles that should be inserted when the source document has no heading"
        ),
    )
    parser.add_argument(
        "--first-block-is-title",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="classify the first non-empty block as the book title (default: true)",
    )
    return parser


def load_glyph_map(path: Path | None) -> dict[str, str] | None:
    """Read a glyph-map JSON file: archive image path -> depicted characters."""

    if path is None:
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise BookImportError(f"cannot read glyph map {path}: {error}") from error
    if not isinstance(raw, dict) or not raw:
        raise BookImportError("glyph map must be a non-empty JSON object")
    glyph_map: dict[str, str] = {}
    for href, glyph in raw.items():
        if not isinstance(href, str) or not href.strip():
            raise BookImportError("glyph map keys must be archive image paths")
        if not isinstance(glyph, str) or not glyph or len(glyph) > 4:
            raise BookImportError(
                f"glyph map value for {href!r} must be 1-4 characters of text"
            )
        glyph_map[href] = glyph
    return glyph_map


def load_chapter_map(path: Path | None) -> dict[str, str] | None:
    """Read an EPUB chapter map: archive spine path -> source navigation label."""

    if path is None:
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise BookImportError(f"cannot read EPUB chapter map {path}: {error}") from error
    if not isinstance(raw, dict) or not raw:
        raise BookImportError("EPUB chapter map must be a non-empty JSON object")
    chapter_map: dict[str, str] = {}
    for href, title in raw.items():
        if not isinstance(href, str) or not href.strip():
            raise BookImportError("EPUB chapter map keys must be archive spine paths")
        if not isinstance(title, str) or not title.strip():
            raise BookImportError(f"chapter title for {href!r} must be non-empty text")
        chapter_map[href] = title.strip()
    return chapter_map


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        suffix = args.input.suffix.lower()
        if suffix == ".txt":
            if args.glyph_map is not None:
                raise BookImportError("--glyph-map only applies to EPUB input")
            if args.epub_note_document:
                raise BookImportError("--epub-note-document only applies to EPUB input")
            if args.epub_note_class:
                raise BookImportError("--epub-note-class only applies to EPUB input")
            if args.epub_skip_document:
                raise BookImportError("--epub-skip-document only applies to EPUB input")
            if args.epub_chapter_map is not None:
                raise BookImportError("--epub-chapter-map only applies to EPUB input")
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
                glyph_map=load_glyph_map(args.glyph_map),
                note_documents=set(args.epub_note_document),
                note_class_tokens=set(args.epub_note_class),
                skip_documents=set(args.epub_skip_document),
                chapter_titles=load_chapter_map(args.epub_chapter_map),
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
