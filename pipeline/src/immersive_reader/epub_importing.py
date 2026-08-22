"""Deterministic EPUB import into the unified Reader source contract."""

from __future__ import annotations

import hashlib
import io
import re
import zipfile
from collections.abc import Callable
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
_TEXT_BLOCK_TAGS = {"p", "pre", "figcaption"}
_CONTAINER_TAGS = {"blockquote", "li", "div"}
_IGNORED_TAGS = {"script", "style", "svg", "math", "head", "rt", "rp"}
# Class tokens scholarly editions use for annotation blocks (校注、脚注、尾注).
_NOTE_CLASS_TOKENS = {"note", "notes", "footnote", "footnotes", "endnote", "endnotes"}
_WHITESPACE = re.compile(r"[^\S\n]+")
_IMAGE_EXTENSIONS = {
    "image/jpeg": ".jpeg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}


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
    is_caption: bool = False


@dataclass(frozen=True)
class EpubRawIllustration:
    source_path: str
    media_type: str
    content: bytes
    title: str
    anchor_block_index: int


@dataclass(frozen=True)
class EpubImageReference:
    href: str
    alt: str
    before_block_index: int


@dataclass(frozen=True)
class EpubCompilation:
    document: dict[str, object]
    extracted_files: dict[str, bytes]


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
    glyph_map: dict[str, str] | None = None,
    note_documents: set[str] | None = None,
) -> dict[str, object]:
    """Compile EPUB package metadata and spine text into source.json data."""

    return _compile_epub_source(
        source_bytes,
        book_id=book_id,
        revision=revision,
        title=title,
        language=language,
        glyph_map=glyph_map,
        note_documents=note_documents,
    ).document


def _compile_epub_source(
    source_bytes: bytes,
    *,
    book_id: str,
    revision: int,
    title: str | None,
    language: str | None,
    glyph_map: dict[str, str] | None = None,
    note_documents: set[str] | None = None,
) -> EpubCompilation:
    """Compile EPUB text and supported source illustrations deterministically."""

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
        blocks, source_illustrations = _spine_content(
            archive,
            members,
            package_path,
            manifest,
            spine_ids,
            metadata.title,
            glyph_map or {},
            note_documents or set(),
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

    extracted_files: dict[str, bytes] = {}
    illustrations: list[dict[str, object]] = []
    for index, illustration in enumerate(source_illustrations, start=1):
        extension = _IMAGE_EXTENSIONS[illustration.media_type]
        illustration_id = f"ill{index:04d}"
        extracted_path = f"source-assets/illustration-{index:04d}{extension}"
        paragraph_index = illustration.anchor_block_index + 2
        anchor_id = f"p{paragraph_index:0{width}d}"
        illustrations.append(
            {
                "id": illustration_id,
                "at": anchor_id,
                "title": illustration.title,
                "path": extracted_path,
                "media_type": illustration.media_type,
                "sha256": hashlib.sha256(illustration.content).hexdigest(),
                "source_href": illustration.source_path,
            }
        )
        extracted_files[extracted_path] = illustration.content
    if illustrations:
        document["illustrations"] = illustrations
    return EpubCompilation(document, extracted_files)


def import_epub(
    input_path: Path,
    output_dir: Path,
    *,
    book_id: str,
    revision: int = 1,
    title: str | None = None,
    language: str | None = None,
    glyph_map: dict[str, str] | None = None,
    note_documents: set[str] | None = None,
) -> ImportResult:
    """Freeze an EPUB and atomically write its unified source manifest."""

    input_path = input_path.resolve()
    if input_path.suffix.lower() != ".epub":
        raise EpubImportError(f"input must be an .epub file: {input_path}")
    source_bytes = input_path.read_bytes()
    compilation = _compile_epub_source(
        source_bytes,
        book_id=book_id,
        revision=revision,
        title=title,
        language=language,
        glyph_map=glyph_map,
        note_documents=note_documents,
    )
    return write_source_bundle(
        input_path,
        output_dir,
        source_bytes=source_bytes,
        document=compilation.document,
        extra_files=compilation.extracted_files,
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


def _spine_content(
    archive: zipfile.ZipFile,
    members: dict[str, zipfile.ZipInfo],
    package_path: str,
    manifest: dict[str, ManifestItem],
    spine_ids: list[str],
    title: str,
    glyph_map: dict[str, str],
    note_documents: set[str],
) -> tuple[list[EpubTextBlock], list[EpubRawIllustration]]:
    package_dir = str(PurePosixPath(package_path).parent)
    if package_dir == ".":
        package_dir = ""
    manifest_by_path = {
        _normalize_member_path(package_dir, item.href): item
        for item in manifest.values()
    }
    blocks: list[EpubTextBlock] = []
    illustrations: list[EpubRawIllustration] = []
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
        item_dir = str(PurePosixPath(member_path).parent)
        if item_dir == ".":
            item_dir = ""

        def glyph_for(href: str, base_dir: str = item_dir) -> str | None:
            if not glyph_map or not href:
                return None
            try:
                return glyph_map.get(_normalize_member_path(base_dir, href))
            except EpubImportError:
                return None

        document_blocks, document_images = _xhtml_content(root, glyph_for)
        removed_leading_blocks = 0
        if not blocks and document_blocks:
            first = document_blocks[0]
            if first.kind == "chapter_heading" and _same_text(first.text, title):
                document_blocks = document_blocks[1:]
                removed_leading_blocks = 1
        if member_path in note_documents:
            document_blocks = [
                EpubTextBlock("note", block.text, block.is_caption)
                for block in document_blocks
            ]

        global_block_offset = len(blocks)
        document_dir = str(PurePosixPath(member_path).parent)
        if document_dir == ".":
            document_dir = ""
        for image in document_images:
            local_anchor = image.before_block_index - removed_leading_blocks
            next_block = (
                document_blocks[local_anchor]
                if 0 <= local_anchor < len(document_blocks)
                else None
            )
            previous_block = (
                document_blocks[local_anchor - 1]
                if 0 < local_anchor <= len(document_blocks)
                else None
            )
            if next_block is not None and next_block.is_caption:
                anchor_index = local_anchor
                resolved_title = image.alt or next_block.text
            elif previous_block is not None:
                anchor_index = local_anchor - 1
                resolved_title = image.alt or previous_block.text
            elif next_block is not None:
                anchor_index = local_anchor
                resolved_title = image.alt or next_block.text
            else:
                # A cover-only spine document has no textual reading position.
                continue

            image_path = _normalize_member_path(document_dir, image.href)
            resource = manifest_by_path.get(image_path)
            if resource is None:
                raise EpubImportError(
                    f"spine image is not declared in the OPF manifest: {image_path}"
                )
            if resource.media_type not in _IMAGE_EXTENSIONS:
                raise EpubImportError(
                    f"unsupported source illustration media type "
                    f"{resource.media_type!r} for {image_path}"
                )
            content = _read_required_member(archive, members, image_path)
            illustrations.append(
                EpubRawIllustration(
                    image_path,
                    resource.media_type,
                    content,
                    resolved_title,
                    global_block_offset + anchor_index,
                )
            )
        blocks.extend(document_blocks)
    return blocks, illustrations


GlyphResolver = Callable[[str], str | None]


def _no_glyphs(_href: str) -> str | None:
    return None


def _xhtml_content(
    root: ElementTree.Element,
    glyph_for: GlyphResolver = _no_glyphs,
) -> tuple[list[EpubTextBlock], list[EpubImageReference]]:
    body = next(
        (element for element in root.iter() if _local_name(element.tag) == "body"),
        root,
    )
    blocks: list[EpubTextBlock] = []
    images: list[EpubImageReference] = []

    def remember_descendant_images(element: ElementTree.Element) -> None:
        for descendant in element.iter():
            if descendant is element or _local_name(descendant.tag) != "img":
                continue
            href = descendant.get("src", "").strip()
            if href and glyph_for(href) is None:
                images.append(
                    EpubImageReference(
                        href,
                        _normalize_text(descendant.get("alt", "")),
                        len(blocks),
                    )
                )

    def block_kind(element: ElementTree.Element, default: str) -> str:
        class_tokens = set(element.get("class", "").lower().split())
        if class_tokens & _NOTE_CLASS_TOKENS:
            return "note"
        if _is_link_only(element, glyph_for):
            return "nav"
        return default

    def walk(element: ElementTree.Element, *, in_quote: bool = False) -> None:
        tag = _local_name(element.tag)
        if tag in _IGNORED_TAGS or element.get("aria-hidden") == "true":
            return
        if tag == "img":
            href = element.get("src", "").strip()
            if href and glyph_for(href) is None:
                images.append(
                    EpubImageReference(
                        href,
                        _normalize_text(element.get("alt", "")),
                        len(blocks),
                    )
                )
            return
        if tag in _HEADING_TAGS:
            _append_block(blocks, "chapter_heading", _element_text(element, glyph_for))
            remember_descendant_images(element)
            return
        if tag in _TEXT_BLOCK_TAGS:
            kind = block_kind(element, "epigraph" if in_quote else "prose")
            class_tokens = set(element.get("class", "").lower().split())
            is_caption = tag == "figcaption" or bool(
                class_tokens & {"caption", "figcaption", "image-note"}
            )
            _append_block(
                blocks,
                kind,
                _element_text(element, glyph_for),
                is_caption=is_caption,
            )
            remember_descendant_images(element)
            return
        if tag in _CONTAINER_TAGS:
            has_nested_block = any(
                descendant is not element
                and _local_name(descendant.tag)
                in (_HEADING_TAGS | _TEXT_BLOCK_TAGS | _CONTAINER_TAGS)
                for descendant in element.iter()
            )
            if not has_nested_block:
                default = "epigraph" if in_quote or tag == "blockquote" else "prose"
                kind = block_kind(element, default)
                text = _element_text(element, glyph_for)
                if text:
                    _append_block(blocks, kind, text)
                    remember_descendant_images(element)
                    return

        quoted = in_quote or tag == "blockquote"
        for child in element:
            walk(child, in_quote=quoted)

    walk(body)
    if not blocks:
        _append_block(blocks, "prose", _element_text(body, glyph_for))
    return blocks, images


def _element_text(
    element: ElementTree.Element,
    glyph_for: GlyphResolver = _no_glyphs,
) -> str:
    parts: list[str] = []

    def collect(node: ElementTree.Element) -> None:
        if node.text:
            parts.append(node.text)
        for child in node:
            tag = _local_name(child.tag)
            if tag == "br":
                parts.append("\n")
            elif tag == "img":
                # A mapped glyph image is a rare character the publisher could
                # only typeset as a picture; restore it into the text stream.
                glyph = glyph_for(child.get("src", "").strip())
                if glyph:
                    parts.append(glyph)
            elif tag not in _IGNORED_TAGS:
                collect(child)
            if child.tail:
                parts.append(child.tail)

    collect(element)
    return _normalize_text("".join(parts))


def _is_link_only(element: ElementTree.Element, glyph_for: GlyphResolver) -> bool:
    """True when every visible character of the block sits inside a hyperlink.

    Such blocks are print navigation (tables of contents, jump lists); the
    Reader keeps them in the source but out of the linear reading flow.
    """

    has_link = False
    parts: list[str] = []

    def collect(node: ElementTree.Element) -> None:
        if node.text:
            parts.append(node.text)
        for child in node:
            tag = _local_name(child.tag)
            if tag == "a" and child.get("href", "").strip():
                nonlocal has_link
                if _element_text(child, glyph_for):
                    has_link = True
            elif tag == "img":
                glyph = glyph_for(child.get("src", "").strip())
                if glyph:
                    parts.append(glyph)
            elif tag not in _IGNORED_TAGS:
                collect(child)
            if child.tail:
                parts.append(child.tail)

    collect(element)
    return has_link and not _normalize_text("".join(parts))


def _append_block(
    blocks: list[EpubTextBlock],
    kind: str,
    text: str,
    *,
    is_caption: bool = False,
) -> None:
    if text:
        blocks.append(EpubTextBlock(kind, text, is_caption))


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
