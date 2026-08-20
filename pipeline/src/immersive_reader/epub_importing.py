"""Deterministic EPUB import into the unified Reader source contract."""

from __future__ import annotations

import hashlib
import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

from immersive_reader.importing import (
    BookImportError,
    ImportResult,
    validate_source_metadata,
    write_source_bundle,
)


MIMETYPE = b"application/epub+zip"
CONTAINER_PATH = "META-INF/container.xml"
MAX_EPUB_BYTES = 256 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 10_000
MAX_ARCHIVE_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
MAX_MEMBER_BYTES = 64 * 1024 * 1024

_HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_TEXT_BLOCK_TAGS = {"p", "pre"}
_CONTAINER_TAGS = {"blockquote", "li", "div"}
_IGNORED_TAGS = {"script", "style", "svg", "math", "head", "rt", "rp"}
_WHITESPACE = re.compile(r"[^\S\n]+")


class EpubImportError(BookImportError):
    """Raised when an EPUB cannot be compiled safely."""


@dataclass(frozen=True)
class EpubMetadata:
    title: str
    language: str
    authors: tuple[str, ...]


@dataclass(frozen=True)
class EpubTextBlock:
    kind: str
    text: str


@dataclass(frozen=True)
class ManifestItem:
    identifier: str
    href: str
    media_type: str
    properties: frozenset[str]


def build_epub_source_document(
    source_bytes: bytes,
    *,
    book_id: str,
    revision: int = 1,
    title: str | None = None,
    language: str | None = None,
) -> dict[str, object]:
    """Compile EPUB package metadata and spine text into source.json data."""

    if not source_bytes:
        raise EpubImportError("EPUB file is empty")
    if len(source_bytes) > MAX_EPUB_BYTES:
        raise EpubImportError(
            f"EPUB is larger than the {MAX_EPUB_BYTES // (1024 * 1024)} MiB import limit"
        )

    try:
        archive = zipfile.ZipFile(io.BytesIO(source_bytes))
    except zipfile.BadZipFile as error:
        raise EpubImportError(f"invalid EPUB ZIP container: {error}") from error

    with archive:
        members = _validate_archive(archive)
        if "mimetype" not in members:
            raise EpubImportError("EPUB is missing the required mimetype file")
        if _read_member(archive, members["mimetype"]) != MIMETYPE:
            raise EpubImportError("EPUB mimetype must be application/epub+zip")

        container = _parse_xml(
            _read_required_member(archive, members, CONTAINER_PATH),
            CONTAINER_PATH,
        )
        package_path = _container_package_path(container)
        package = _parse_xml(
            _read_required_member(archive, members, package_path),
            package_path,
        )
        metadata = _package_metadata(package, title=title, language=language)
        validate_source_metadata(book_id, revision, metadata.language)
        manifest = _package_manifest(package)
        spine_ids = _package_spine(package)
        blocks = _spine_blocks(
            archive,
            members,
            package_path,
            manifest,
            spine_ids,
            metadata.title,
        )

    if not blocks:
        raise EpubImportError("EPUB spine contains no supported readable text blocks")

    raw_paragraphs = [EpubTextBlock("title", metadata.title), *blocks]
    width = max(4, len(str(len(raw_paragraphs))))
    paragraphs = [
        {
            "id": f"p{index:0{width}d}",
            "kind": block.kind,
            "text": block.text,
        }
        for index, block in enumerate(raw_paragraphs, start=1)
    ]
    document: dict[str, object] = {
        "schema_version": 1,
        "book_id": book_id,
        "revision": revision,
        "title": metadata.title,
        "language": metadata.language,
        "source": {
            "format": "epub",
            "path": "source.epub",
            "sha256": hashlib.sha256(source_bytes).hexdigest(),
        },
        "paragraphs": paragraphs,
    }
    if metadata.authors:
        document["authors"] = list(metadata.authors)
    return document


def import_epub(
    input_path: Path,
    output_dir: Path,
    *,
    book_id: str,
    revision: int = 1,
    title: str | None = None,
    language: str | None = None,
) -> ImportResult:
    """Freeze an EPUB and atomically write its unified source manifest."""

    input_path = input_path.resolve()
    if input_path.suffix.lower() != ".epub":
        raise EpubImportError(f"input must be an .epub file: {input_path}")
    source_bytes = input_path.read_bytes()
    document = build_epub_source_document(
        source_bytes,
        book_id=book_id,
        revision=revision,
        title=title,
        language=language,
    )
    return write_source_bundle(
        input_path,
        output_dir,
        source_bytes=source_bytes,
        document=document,
    )


def _validate_archive(archive: zipfile.ZipFile) -> dict[str, zipfile.ZipInfo]:
    infos = archive.infolist()
    if len(infos) > MAX_ARCHIVE_ENTRIES:
        raise EpubImportError(
            f"EPUB has more than {MAX_ARCHIVE_ENTRIES} archive entries"
        )
    total_size = sum(info.file_size for info in infos)
    if total_size > MAX_ARCHIVE_UNCOMPRESSED_BYTES:
        raise EpubImportError(
            "EPUB uncompressed content exceeds the safe import limit"
        )

    members: dict[str, zipfile.ZipInfo] = {}
    for info in infos:
        if info.flag_bits & 0x1:
            raise EpubImportError(f"encrypted EPUB member is not supported: {info.filename}")
        if info.file_size > MAX_MEMBER_BYTES:
            raise EpubImportError(f"EPUB member is too large: {info.filename}")
        normalized = _normalize_member_path("", info.filename)
        if info.is_dir():
            continue
        if normalized in members:
            raise EpubImportError(f"duplicate EPUB member path: {normalized}")
        members[normalized] = info
    return members


def _read_member(archive: zipfile.ZipFile, info: zipfile.ZipInfo) -> bytes:
    with archive.open(info) as member:
        return member.read(MAX_MEMBER_BYTES + 1)


def _read_required_member(
    archive: zipfile.ZipFile,
    members: dict[str, zipfile.ZipInfo],
    path: str,
) -> bytes:
    normalized = _normalize_member_path("", path)
    info = members.get(normalized)
    if info is None or info.is_dir():
        raise EpubImportError(f"EPUB package member does not exist: {normalized}")
    return _read_member(archive, info)


def _parse_xml(content: bytes, path: str) -> ElementTree.Element:
    try:
        return ElementTree.fromstring(content)
    except ElementTree.ParseError as error:
        raise EpubImportError(f"invalid XML in {path}: {error}") from error


def _container_package_path(container: ElementTree.Element) -> str:
    candidates = [
        element
        for element in container.iter()
        if _local_name(element.tag) == "rootfile" and element.get("full-path")
    ]
    if not candidates:
        raise EpubImportError("container.xml does not declare an OPF rootfile")
    default = candidates[0]
    if default.get("media-type") != "application/oebps-package+xml":
        raise EpubImportError(
            "the default OPF rootfile must use application/oebps-package+xml"
        )
    return _normalize_member_path("", default.get("full-path", ""))


def _package_metadata(
    package: ElementTree.Element,
    *,
    title: str | None,
    language: str | None,
) -> EpubMetadata:
    metadata_element = _first_child(package, "metadata")
    if metadata_element is None:
        raise EpubImportError("OPF package is missing metadata")

    package_titles = _child_texts(metadata_element, "title")
    package_languages = _child_texts(metadata_element, "language")
    authors = tuple(dict.fromkeys(_child_texts(metadata_element, "creator")))
    resolved_title = _normalize_text(title or (package_titles[0] if package_titles else ""))
    resolved_language = _normalize_language(
        language or (package_languages[0] if package_languages else "und")
    )
    if not resolved_title:
        raise EpubImportError("EPUB metadata has no title; use --title to provide one")
    return EpubMetadata(resolved_title, resolved_language, authors)


def _package_manifest(package: ElementTree.Element) -> dict[str, ManifestItem]:
    manifest_element = _first_child(package, "manifest")
    if manifest_element is None:
        raise EpubImportError("OPF package is missing a manifest")

    manifest: dict[str, ManifestItem] = {}
    for element in manifest_element:
        if _local_name(element.tag) != "item":
            continue
        identifier = element.get("id", "").strip()
        href = element.get("href", "").strip()
        media_type = element.get("media-type", "").strip().lower()
        if not identifier or not href or not media_type:
            raise EpubImportError("every OPF manifest item needs id, href, and media-type")
        if identifier in manifest:
            raise EpubImportError(f"duplicate OPF manifest id: {identifier}")
        manifest[identifier] = ManifestItem(
            identifier,
            href,
            media_type,
            frozenset(element.get("properties", "").split()),
        )
    if not manifest:
        raise EpubImportError("OPF manifest is empty")
    return manifest


def _package_spine(package: ElementTree.Element) -> list[str]:
    spine = _first_child(package, "spine")
    if spine is None:
        raise EpubImportError("OPF package is missing a spine")
    identifiers = [
        element.get("idref", "").strip()
        for element in spine
        if _local_name(element.tag) == "itemref"
        and element.get("linear", "yes").lower() != "no"
    ]
    if not all(identifiers):
        raise EpubImportError("every linear OPF spine item needs an idref")
    if not identifiers:
        raise EpubImportError("OPF spine has no linear reading items")
    return identifiers


def _spine_blocks(
    archive: zipfile.ZipFile,
    members: dict[str, zipfile.ZipInfo],
    package_path: str,
    manifest: dict[str, ManifestItem],
    spine_ids: list[str],
    title: str,
) -> list[EpubTextBlock]:
    package_dir = str(PurePosixPath(package_path).parent)
    if package_dir == ".":
        package_dir = ""
    blocks: list[EpubTextBlock] = []
    for identifier in spine_ids:
        item = manifest.get(identifier)
        if item is None:
            raise EpubImportError(f"OPF spine references missing manifest id: {identifier}")
        if "nav" in item.properties:
            continue
        if item.media_type not in {"application/xhtml+xml", "text/html"}:
            raise EpubImportError(
                f"unsupported spine media type {item.media_type!r} for {item.href}"
            )
        member_path = _normalize_member_path(package_dir, item.href)
        root = _parse_xml(
            _read_required_member(archive, members, member_path),
            member_path,
        )
        document_blocks = _xhtml_blocks(root)
        if not blocks and document_blocks:
            first = document_blocks[0]
            if first.kind == "chapter_heading" and _same_text(first.text, title):
                document_blocks = document_blocks[1:]
        blocks.extend(document_blocks)
    return blocks


def _xhtml_blocks(root: ElementTree.Element) -> list[EpubTextBlock]:
    body = next(
        (element for element in root.iter() if _local_name(element.tag) == "body"),
        root,
    )
    blocks: list[EpubTextBlock] = []

    def walk(element: ElementTree.Element, *, in_quote: bool = False) -> None:
        tag = _local_name(element.tag)
        if tag in _IGNORED_TAGS or element.get("aria-hidden") == "true":
            return
        if tag in _HEADING_TAGS:
            _append_block(blocks, "chapter_heading", _element_text(element))
            return
        if tag in _TEXT_BLOCK_TAGS:
            kind = "epigraph" if in_quote else "prose"
            _append_block(blocks, kind, _element_text(element))
            return
        if tag in _CONTAINER_TAGS:
            has_nested_block = any(
                descendant is not element
                and _local_name(descendant.tag)
                in (_HEADING_TAGS | _TEXT_BLOCK_TAGS | _CONTAINER_TAGS)
                for descendant in element.iter()
            )
            if not has_nested_block:
                kind = "epigraph" if in_quote or tag == "blockquote" else "prose"
                _append_block(blocks, kind, _element_text(element))
                return

        quoted = in_quote or tag == "blockquote"
        for child in element:
            walk(child, in_quote=quoted)

    walk(body)
    if not blocks:
        _append_block(blocks, "prose", _element_text(body))
    return blocks


def _element_text(element: ElementTree.Element) -> str:
    parts: list[str] = []

    def collect(node: ElementTree.Element) -> None:
        if node.text:
            parts.append(node.text)
        for child in node:
            tag = _local_name(child.tag)
            if tag == "br":
                parts.append("\n")
            elif tag not in _IGNORED_TAGS:
                collect(child)
            if child.tail:
                parts.append(child.tail)

    collect(element)
    return _normalize_text("".join(parts))


def _append_block(blocks: list[EpubTextBlock], kind: str, text: str) -> None:
    if text:
        blocks.append(EpubTextBlock(kind, text))


def _normalize_text(text: str) -> str:
    normalized_lines = [
        _WHITESPACE.sub(" ", line.replace("\u00a0", " ")).strip()
        for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ]
    return "\n".join(line for line in normalized_lines if line).strip()


def _normalize_language(language: str) -> str:
    return language.strip().replace("_", "-") or "und"


def _normalize_member_path(base: str, href: str) -> str:
    decoded = unquote(urlsplit(href).path).replace("\\", "/")
    if not decoded or decoded.startswith("/"):
        raise EpubImportError(f"unsafe or empty EPUB member path: {href!r}")
    parts: list[str] = []
    for part in PurePosixPath(base, decoded).parts:
        if part in {"", "."}:
            continue
        if part == "..":
            if not parts:
                raise EpubImportError(f"EPUB member path escapes the archive root: {href}")
            parts.pop()
            continue
        parts.append(part)
    if not parts:
        raise EpubImportError(f"unsafe or empty EPUB member path: {href!r}")
    return "/".join(parts)


def _first_child(
    parent: ElementTree.Element,
    local_name: str,
) -> ElementTree.Element | None:
    return next(
        (child for child in parent if _local_name(child.tag) == local_name),
        None,
    )


def _child_texts(parent: ElementTree.Element, local_name: str) -> list[str]:
    return [
        text
        for child in parent
        if _local_name(child.tag) == local_name
        and (text := _normalize_text("".join(child.itertext())))
    ]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _same_text(left: str, right: str) -> bool:
    return _WHITESPACE.sub(" ", left).casefold() == _WHITESPACE.sub(" ", right).casefold()
