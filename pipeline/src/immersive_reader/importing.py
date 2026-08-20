"""Deterministic TXT import for immutable Reader sources."""

from __future__ import annotations

import codecs
import hashlib
import json
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path


SUPPORTED_ENCODINGS = (
    "utf-8",
    "utf-8-sig",
    "utf-16-le",
    "utf-16-be",
    "utf-32-le",
    "utf-32-be",
    "gb18030",
)

_BOOK_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_LANGUAGE = re.compile(r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")
_CHAPTER_HEADING = re.compile(
    r"^第[0-9０-９一二三四五六七八九十百千万零〇两]+[章节卷部篇回](?:\s|$|[：:])"
)


class TxtImportError(ValueError):
    """Base class for actionable TXT import failures."""


class UnsupportedEncodingError(TxtImportError):
    """Raised when input bytes cannot be decoded safely."""


class ImportConflictError(TxtImportError):
    """Raised when an import would replace a different immutable source."""


@dataclass(frozen=True)
class DecodedText:
    text: str
    encoding: str


@dataclass(frozen=True)
class ImportResult:
    manifest_path: Path
    source_path: Path
    paragraph_count: int
    encoding: str
    sha256: str


def detect_and_decode(source_bytes: bytes, encoding: str = "auto") -> DecodedText:
    """Decode supported TXT bytes without changing the original byte stream."""

    if not source_bytes:
        raise TxtImportError("TXT file is empty")

    if encoding != "auto":
        if encoding not in SUPPORTED_ENCODINGS:
            supported = ", ".join(SUPPORTED_ENCODINGS)
            raise UnsupportedEncodingError(
                f"unsupported encoding {encoding!r}; choose one of: {supported}"
            )
        try:
            text = source_bytes.decode(encoding)
        except UnicodeDecodeError as error:
            raise UnsupportedEncodingError(
                f"TXT bytes are not valid {encoding}: {error}"
            ) from error
        return DecodedText(_clean_decoded_text(text, encoding), encoding)

    bom_candidates = (
        (codecs.BOM_UTF32_LE, "utf-32-le"),
        (codecs.BOM_UTF32_BE, "utf-32-be"),
        (codecs.BOM_UTF8, "utf-8-sig"),
        (codecs.BOM_UTF16_LE, "utf-16-le"),
        (codecs.BOM_UTF16_BE, "utf-16-be"),
    )
    for bom, detected_encoding in bom_candidates:
        if source_bytes.startswith(bom):
            text = source_bytes.decode(detected_encoding)
            return DecodedText(
                _clean_decoded_text(text, detected_encoding),
                detected_encoding,
            )

    errors: list[str] = []
    for candidate in ("utf-8", "gb18030"):
        try:
            text = source_bytes.decode(candidate)
            return DecodedText(_clean_decoded_text(text, candidate), candidate)
        except (UnicodeDecodeError, TxtImportError) as error:
            errors.append(f"{candidate}: {error}")

    details = "; ".join(errors)
    raise UnsupportedEncodingError(
        "could not detect TXT encoding; use --encoding to select one explicitly"
        f" ({details})"
    )


def split_text_blocks(text: str) -> list[str]:
    """Split text on one or more whitespace-only lines, preserving block text."""

    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    blocks: list[str] = []
    current: list[str] = []

    for line in normalized.split("\n"):
        if line.strip():
            current.append(line)
        elif current:
            blocks.append("\n".join(current))
            current = []

    if current:
        blocks.append("\n".join(current))

    if not blocks:
        raise TxtImportError("TXT file contains no readable text blocks")
    return blocks


def build_source_document(
    source_bytes: bytes,
    *,
    source_name: str,
    book_id: str,
    revision: int = 1,
    title: str | None = None,
    language: str = "zh-CN",
    encoding: str = "auto",
    first_block_is_title: bool = True,
) -> dict[str, object]:
    """Build a deterministic source document from immutable TXT bytes."""

    _validate_metadata(book_id, revision, language)
    decoded = detect_and_decode(source_bytes, encoding)
    blocks = split_text_blocks(decoded.text)

    resolved_title = title
    if resolved_title is None:
        resolved_title = blocks[0] if first_block_is_title else Path(source_name).stem
    if not resolved_title.strip():
        raise TxtImportError("book title must not be empty")

    width = max(4, len(str(len(blocks))))
    paragraphs = [
        {
            "id": f"p{index:0{width}d}",
            "kind": _paragraph_kind(
                text,
                is_first=index == 1,
                first_block_is_title=first_block_is_title,
            ),
            "text": text,
        }
        for index, text in enumerate(blocks, start=1)
    ]

    return {
        "schema_version": 1,
        "book_id": book_id,
        "revision": revision,
        "title": resolved_title,
        "language": language,
        "source": {
            "format": "txt",
            "path": "source.txt",
            "sha256": hashlib.sha256(source_bytes).hexdigest(),
            "encoding": decoded.encoding,
        },
        "paragraphs": paragraphs,
    }


def import_txt(
    input_path: Path,
    output_dir: Path,
    *,
    book_id: str,
    revision: int = 1,
    title: str | None = None,
    language: str = "zh-CN",
    encoding: str = "auto",
    first_block_is_title: bool = True,
) -> ImportResult:
    """Freeze a TXT file and atomically write its deterministic manifest."""

    input_path = input_path.resolve()
    output_dir = output_dir.resolve()
    if input_path.suffix.lower() != ".txt":
        raise TxtImportError(f"input must be a .txt file: {input_path}")

    source_bytes = input_path.read_bytes()
    document = build_source_document(
        source_bytes,
        source_name=input_path.name,
        book_id=book_id,
        revision=revision,
        title=title,
        language=language,
        encoding=encoding,
        first_block_is_title=first_block_is_title,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    source_path = output_dir / "source.txt"
    manifest_path = output_dir / "source.json"
    expected_hash = document["source"]["sha256"]  # type: ignore[index]

    if manifest_path.exists():
        _check_existing_manifest_identity(manifest_path, expected_hash, book_id, revision)
    if source_path.exists():
        actual_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
        if actual_hash != expected_hash:
            raise ImportConflictError(
                f"refusing to replace a different immutable source: {source_path}; "
                "choose a new output directory or revision"
            )
    elif input_path != source_path:
        _atomic_write_bytes(source_path, source_bytes)

    serialized = json.dumps(document, ensure_ascii=False, indent=2) + "\n"
    _atomic_write_text(manifest_path, serialized)

    source = document["source"]
    return ImportResult(
        manifest_path=manifest_path,
        source_path=source_path,
        paragraph_count=len(document["paragraphs"]),  # type: ignore[arg-type]
        encoding=source["encoding"],  # type: ignore[index]
        sha256=expected_hash,  # type: ignore[arg-type]
    )


def _clean_decoded_text(text: str, encoding: str) -> str:
    text = text.removeprefix("\ufeff")
    disallowed_controls = [
        character
        for character in text
        if ord(character) < 32 and character not in "\t\n\r"
    ]
    if disallowed_controls:
        raise UnsupportedEncodingError(
            f"decoded {encoding} text contains control characters; "
            "select the correct encoding"
        )
    return text


def _validate_metadata(book_id: str, revision: int, language: str) -> None:
    if not _BOOK_ID.fullmatch(book_id):
        raise TxtImportError(
            "book ID must use lowercase ASCII words separated by single hyphens"
        )
    if revision < 1:
        raise TxtImportError("revision must be at least 1")
    if not _LANGUAGE.fullmatch(language):
        raise TxtImportError(f"invalid language tag: {language!r}")


def _paragraph_kind(
    text: str,
    *,
    is_first: bool,
    first_block_is_title: bool,
) -> str:
    if is_first and first_block_is_title:
        return "title"
    if "\n" not in text and len(text) <= 80 and _CHAPTER_HEADING.match(text):
        return "chapter_heading"
    if text.startswith("——"):
        return "epigraph"
    return "prose"


def _check_existing_manifest_identity(
    manifest_path: Path,
    expected_hash: str,
    book_id: str,
    revision: int,
) -> None:
    try:
        existing = json.loads(manifest_path.read_text(encoding="utf-8"))
        existing_hash = existing["source"]["sha256"]
        existing_identity = (existing["book_id"], existing["revision"])
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError) as error:
        raise ImportConflictError(
            f"refusing to replace unreadable manifest: {manifest_path}: {error}"
        ) from error

    if existing_hash != expected_hash or existing_identity != (book_id, revision):
        raise ImportConflictError(
            f"refusing to replace source manifest with a different identity: {manifest_path}; "
            "choose a new output directory or revision"
        )


def _atomic_write_bytes(path: Path, content: bytes) -> None:
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    temporary_path.replace(path)


def _atomic_write_text(path: Path, content: str) -> None:
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="\n",
        dir=path.parent,
        delete=False,
    ) as temporary:
        temporary.write(content)
        temporary_path = Path(temporary.name)
    temporary_path.replace(path)
