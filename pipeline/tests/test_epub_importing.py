import base64
import hashlib
import io
import json
import zipfile
from pathlib import Path

import pytest
from immersive_reader.epub_importing import (
    EpubImportError,
    build_epub_source_document,
    import_epub,
)
from immersive_reader.importer import main
from immersive_reader.importing import ImportConflictError
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
SOURCE_SCHEMA = ROOT / "contracts" / "source.schema.json"

CONTAINER_XML = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""

CHAPTER_ONE = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>包内页面标题不应进入正文</title></head>
  <body>
    <h1>测试 EPUB</h1>
    <p>第一章正文<br/>仍在同一段，<em>强调文字</em>保留。</p>
    <div class="para">只有 div 的正文。</div>
    <ul><li>列表内容</li></ul>
  </body>
</html>
"""

CHAPTER_TWO = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h2>第二章</h2>
    <blockquote><p>一段题记。</p></blockquote>
    <p>第二章正文。</p>
  </body>
</html>
"""

NAV_DOCUMENT = """<html xmlns="http://www.w3.org/1999/xhtml"><body>
<nav><ol><li>目录不应进入正文</li></ol></nav>
</body></html>"""


def package_document(
    *,
    spine: str = '<itemref idref="chapter-one"/><itemref idref="chapter-two"/>',
    chapter_one_href: str = "Text/chapter%20one.xhtml",
    metadata: str | None = None,
    manifest_extra: str = "",
) -> str:
    metadata = metadata or """
    <dc:title>测试 EPUB</dc:title>
    <dc:language>zh_CN</dc:language>
    <dc:creator>测试作者</dc:creator>
    <dc:creator>第二作者</dc:creator>
    """
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0"
  xmlns="http://www.idpf.org/2007/opf"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <metadata>{metadata}</metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter-one" href="{chapter_one_href}" media-type="application/xhtml+xml"/>
    <item id="chapter-two" href="Text/chapter-two.xhtml" media-type="application/xhtml+xml"/>
    {manifest_extra}
  </manifest>
  <spine>{spine}</spine>
</package>
"""


def make_epub(
    *,
    opf: str | None = None,
    chapter_one: str = CHAPTER_ONE,
    chapter_two: str = CHAPTER_TWO,
    extra_members: dict[str, bytes | str] | None = None,
) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr(
            "mimetype",
            b"application/epub+zip",
            compress_type=zipfile.ZIP_STORED,
        )
        archive.writestr("META-INF/container.xml", CONTAINER_XML)
        archive.writestr("EPUB/package.opf", opf or package_document())
        # ZIP order is deliberately different from OPF spine order.
        archive.writestr("EPUB/Text/chapter-two.xhtml", chapter_two)
        archive.writestr("EPUB/nav.xhtml", NAV_DOCUMENT)
        archive.writestr("EPUB/Text/chapter one.xhtml", chapter_one)
        for path, content in (extra_members or {}).items():
            archive.writestr(path, content)
    return output.getvalue()


TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

ILLUSTRATED_CHAPTER = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>测试 EPUB</h1>
    <div class="box-center">
      <img src="../Images/map.png" alt=""/>
      <p class="image-note">关键地图</p>
    </div>
    <p>地图之后的正文。</p>
  </body>
</html>
"""


def test_epub_uses_package_metadata_and_spine_order() -> None:
    source_bytes = make_epub()

    document = build_epub_source_document(source_bytes, book_id="epub-book")

    assert document["title"] == "测试 EPUB"
    assert document["language"] == "zh-CN"
    assert document["authors"] == ["测试作者", "第二作者"]
    assert document["source"] == {
        "format": "epub",
        "path": "source.epub",
        "sha256": hashlib.sha256(source_bytes).hexdigest(),
    }
    assert document["paragraphs"] == [
        {"id": "p0001", "kind": "title", "text": "测试 EPUB"},
        {
            "id": "p0002",
            "kind": "prose",
            "text": "第一章正文\n仍在同一段，强调文字保留。",
        },
        {"id": "p0003", "kind": "prose", "text": "只有 div 的正文。"},
        {"id": "p0004", "kind": "prose", "text": "列表内容"},
        {"id": "p0005", "kind": "chapter_heading", "text": "第二章"},
        {"id": "p0006", "kind": "epigraph", "text": "一段题记。"},
        {"id": "p0007", "kind": "prose", "text": "第二章正文。"},
    ]


def test_epub_output_matches_source_schema() -> None:
    document = build_epub_source_document(make_epub(), book_id="schema-epub")
    schema = json.loads(SOURCE_SCHEMA.read_text(encoding="utf-8"))

    Draft202012Validator(schema).validate(document)


def test_epub_extracts_spine_illustrations_without_shifting_paragraph_ids(
    tmp_path: Path,
) -> None:
    opf = package_document(
        spine='<itemref idref="chapter-one"/>',
        manifest_extra='<item id="map" href="Images/map.png" media-type="image/png"/>',
    )
    source_bytes = make_epub(
        opf=opf,
        chapter_one=ILLUSTRATED_CHAPTER,
        extra_members={"EPUB/Images/map.png": TINY_PNG},
    )
    input_path = tmp_path / "illustrated.epub"
    output_dir = tmp_path / "bundle"
    input_path.write_bytes(source_bytes)

    result = import_epub(input_path, output_dir, book_id="illustrated-epub")
    document = json.loads(result.manifest_path.read_text(encoding="utf-8"))

    assert document["paragraphs"] == [
        {"id": "p0001", "kind": "title", "text": "测试 EPUB"},
        {"id": "p0002", "kind": "prose", "text": "关键地图"},
        {"id": "p0003", "kind": "prose", "text": "地图之后的正文。"},
    ]
    assert document["illustrations"] == [
        {
            "id": "ill0001",
            "at": "p0002",
            "title": "关键地图",
            "path": "source-assets/illustration-0001.png",
            "media_type": "image/png",
            "sha256": hashlib.sha256(TINY_PNG).hexdigest(),
            "source_href": "EPUB/Images/map.png",
        }
    ]
    assert (output_dir / "source-assets" / "illustration-0001.png").read_bytes() == TINY_PNG
    schema = json.loads(SOURCE_SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(document)


def test_spine_image_must_be_declared_in_manifest() -> None:
    opf = package_document(spine='<itemref idref="chapter-one"/>')

    with pytest.raises(EpubImportError, match="not declared in the OPF manifest"):
        build_epub_source_document(
            make_epub(
                opf=opf,
                chapter_one=ILLUSTRATED_CHAPTER,
                extra_members={"EPUB/Images/map.png": TINY_PNG},
            ),
            book_id="undeclared-image",
        )


def test_epub_metadata_can_be_overridden() -> None:
    opf = package_document(metadata="<dc:creator>唯一作者</dc:creator>")

    document = build_epub_source_document(
        make_epub(opf=opf),
        book_id="override-epub",
        title="覆盖标题",
        language="ja-JP",
    )

    assert document["title"] == "覆盖标题"
    assert document["language"] == "ja-JP"
    assert document["authors"] == ["唯一作者"]


def test_missing_title_is_actionable() -> None:
    opf = package_document(metadata="<dc:language>zh-CN</dc:language>")

    with pytest.raises(EpubImportError, match="no title"):
        build_epub_source_document(make_epub(opf=opf), book_id="untitled-epub")


def test_missing_spine_manifest_reference_is_rejected() -> None:
    opf = package_document(spine='<itemref idref="missing"/>')

    with pytest.raises(EpubImportError, match="missing manifest id"):
        build_epub_source_document(make_epub(opf=opf), book_id="broken-spine")


def test_non_linear_spine_items_are_not_imported() -> None:
    opf = package_document(
        spine='<itemref idref="chapter-one"/><itemref idref="chapter-two" linear="no"/>'
    )

    document = build_epub_source_document(make_epub(opf=opf), book_id="linear-epub")

    assert [paragraph["text"] for paragraph in document["paragraphs"]] == [
        "测试 EPUB",
        "第一章正文\n仍在同一段，强调文字保留。",
        "只有 div 的正文。",
        "列表内容",
    ]


def test_missing_mimetype_is_rejected() -> None:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("META-INF/container.xml", CONTAINER_XML)

    with pytest.raises(EpubImportError, match="required mimetype"):
        build_epub_source_document(output.getvalue(), book_id="no-mimetype")


def test_spine_path_cannot_escape_archive_root() -> None:
    opf = package_document(chapter_one_href="../../outside.xhtml")

    with pytest.raises(EpubImportError, match="escapes the archive root"):
        build_epub_source_document(make_epub(opf=opf), book_id="unsafe-epub")


def test_invalid_zip_is_rejected() -> None:
    with pytest.raises(EpubImportError, match="invalid EPUB ZIP container"):
        build_epub_source_document(b"not a zip", book_id="invalid-epub")


def test_malformed_spine_xhtml_is_rejected() -> None:
    with pytest.raises(EpubImportError, match="invalid XML"):
        build_epub_source_document(
            make_epub(chapter_one="<html><body><p>broken"),
            book_id="malformed-epub",
        )


def test_import_preserves_original_epub_and_is_idempotent(tmp_path: Path) -> None:
    input_path = tmp_path / "book.epub"
    output_dir = tmp_path / "bundle"
    source_bytes = make_epub()
    input_path.write_bytes(source_bytes)

    first = import_epub(input_path, output_dir, book_id="preserved-epub")
    first_manifest = first.manifest_path.read_bytes()
    second = import_epub(input_path, output_dir, book_id="preserved-epub")

    assert first.source_path.name == "source.epub"
    assert first.source_path.read_bytes() == source_bytes
    assert second.manifest_path.read_bytes() == first_manifest
    assert first.encoding is None
    assert first.paragraph_count == 7


def test_import_refuses_to_replace_another_epub(tmp_path: Path) -> None:
    input_path = tmp_path / "book.epub"
    output_dir = tmp_path / "bundle"
    input_path.write_bytes(make_epub())
    import_epub(input_path, output_dir, book_id="versioned-epub")
    input_path.write_bytes(make_epub(chapter_two=CHAPTER_TWO.replace("正文", "修改")))

    with pytest.raises(ImportConflictError, match="different identity"):
        import_epub(input_path, output_dir, book_id="versioned-epub", revision=2)


def test_unified_cli_imports_epub(tmp_path: Path, capsys: object) -> None:
    input_path = tmp_path / "book.epub"
    output_dir = tmp_path / "bundle"
    input_path.write_bytes(make_epub())

    exit_code = main(
        [
            str(input_path),
            "--output",
            str(output_dir),
            "--book-id",
            "cli-epub",
        ]
    )

    assert exit_code == 0
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "Imported 7 paragraphs as EPUB spine" in captured.out
    assert (output_dir / "source.epub").is_file()


def test_epub_rejects_txt_encoding_option(tmp_path: Path, capsys: object) -> None:
    input_path = tmp_path / "book.epub"
    input_path.write_bytes(make_epub())

    exit_code = main(
        [
            str(input_path),
            "--output",
            str(tmp_path / "bundle"),
            "--book-id",
            "encoding-epub",
            "--encoding",
            "utf-8",
        ]
    )

    assert exit_code == 1
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "--encoding only applies to TXT" in captured.err


ANNOTATED_CHAPTER = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>测试 EPUB</h1>
    <p>正文之中有注<a href="chapter-two.xhtml#m1"><sup>[1]</sup></a>标。</p>
    <p class="note"><a id="m1"></a>[1] 注标——这一条是校注。</p>
    <p class="footNote">〔一〕 校记也是注释。</p>
    <ul>
      <li><a href="chapter-two.xhtml">第二回 链接目录行</a></li>
    </ul>
    <p><a href="chapter-two.xhtml">链接</a>与正文混排不算目录。</p>
  </body>
</html>
"""


def test_note_and_link_only_blocks_are_classified() -> None:
    opf = package_document(spine='<itemref idref="chapter-one"/>')

    document = build_epub_source_document(
        make_epub(opf=opf, chapter_one=ANNOTATED_CHAPTER),
        book_id="annotated-epub",
    )

    assert document["paragraphs"] == [
        {"id": "p0001", "kind": "title", "text": "测试 EPUB"},
        {"id": "p0002", "kind": "prose", "text": "正文之中有注[1]标。"},
        {"id": "p0003", "kind": "note", "text": "[1] 注标——这一条是校注。"},
        {"id": "p0004", "kind": "note", "text": "〔一〕 校记也是注释。"},
        {"id": "p0005", "kind": "nav", "text": "第二回 链接目录行"},
        {"id": "p0006", "kind": "prose", "text": "链接与正文混排不算目录。"},
    ]
    schema = json.loads(SOURCE_SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(document)


def test_selected_epub_document_can_be_preserved_as_notes() -> None:
    document = build_epub_source_document(
        make_epub(),
        book_id="apparatus-epub",
        note_documents={"EPUB/Text/chapter-two.xhtml"},
    )

    assert document["paragraphs"][-3:] == [
        {"id": "p0005", "kind": "note", "text": "第二章"},
        {"id": "p0006", "kind": "note", "text": "一段题记。"},
        {"id": "p0007", "kind": "note", "text": "第二章正文。"},
    ]


def test_selected_epub_document_can_be_preserved_as_navigation() -> None:
    document = build_epub_source_document(
        make_epub(),
        book_id="print-toc-epub",
        nav_documents={"EPUB/Text/chapter-two.xhtml"},
    )

    assert document["paragraphs"][-3:] == [
        {"id": "p0005", "kind": "nav", "text": "第二章"},
        {"id": "p0006", "kind": "nav", "text": "一段题记。"},
        {"id": "p0007", "kind": "nav", "text": "第二章正文。"},
    ]
    schema = json.loads(SOURCE_SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator(schema).validate(document)


def test_document_cannot_be_both_navigation_and_notes() -> None:
    path = "EPUB/Text/chapter-two.xhtml"
    with pytest.raises(EpubImportError, match="both navigation and notes"):
        build_epub_source_document(
            make_epub(),
            book_id="ambiguous-nav-policy-epub",
            note_documents={path},
            nav_documents={path},
        )


def test_custom_epub_class_can_be_classified_as_notes() -> None:
    chapter = CHAPTER_ONE.replace(
        '<ul><li>列表内容</li></ul>',
        '<ul><li class="publisher-footnote">列表内容</li></ul>',
    )
    document = build_epub_source_document(
        make_epub(chapter_one=chapter),
        book_id="custom-note-class-epub",
        note_class_tokens={"publisher-footnote"},
    )

    assert document["paragraphs"][3] == {
        "id": "p0004",
        "kind": "note",
        "text": "列表内容",
    }


def test_selected_non_book_document_can_be_skipped() -> None:
    source_bytes = make_epub()
    document = build_epub_source_document(
        source_bytes,
        book_id="skip-advertising-epub",
        skip_documents={"EPUB/Text/chapter-two.xhtml"},
    )

    assert [paragraph["text"] for paragraph in document["paragraphs"]] == [
        "测试 EPUB",
        "第一章正文\n仍在同一段，强调文字保留。",
        "只有 div 的正文。",
        "列表内容",
    ]
    assert document["source"]["sha256"] == hashlib.sha256(source_bytes).hexdigest()


def test_document_cannot_be_both_noted_and_skipped() -> None:
    path = "EPUB/Text/chapter-two.xhtml"
    with pytest.raises(EpubImportError, match="both preserved as notes and skipped"):
        build_epub_source_document(
            make_epub(),
            book_id="ambiguous-document-policy-epub",
            note_documents={path},
            skip_documents={path},
        )


def test_explicit_chapter_map_inserts_missing_source_heading() -> None:
    document = build_epub_source_document(
        make_epub(),
        book_id="mapped-chapter-epub",
        chapter_titles={"EPUB/Text/chapter one.xhtml": "第一章"},
    )

    assert document["paragraphs"][1:3] == [
        {"id": "p0002", "kind": "chapter_heading", "text": "第一章"},
        {
            "id": "p0003",
            "kind": "prose",
            "text": "第一章正文\n仍在同一段，强调文字保留。",
        },
    ]


GLYPH_CHAPTER = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>测试 EPUB</h1>
    <p>锦衣纨<img class="inline" src="../Images/glyph.png" alt=""/>之时。</p>
    <div class="box-center">
      <img src="../Images/map.png" alt=""/>
      <p class="image-note">关键地图</p>
    </div>
  </body>
</html>
"""


def test_glyph_map_restores_rare_characters_inline(tmp_path: Path) -> None:
    opf = package_document(
        spine='<itemref idref="chapter-one"/>',
        manifest_extra=(
            '<item id="map" href="Images/map.png" media-type="image/png"/>'
            '<item id="glyph" href="Images/glyph.png" media-type="image/png"/>'
        ),
    )
    source_bytes = make_epub(
        opf=opf,
        chapter_one=GLYPH_CHAPTER,
        extra_members={
            "EPUB/Images/map.png": TINY_PNG,
            "EPUB/Images/glyph.png": TINY_PNG,
        },
    )

    document = build_epub_source_document(
        source_bytes,
        book_id="glyph-epub",
        glyph_map={"EPUB/Images/glyph.png": "绔"},
    )

    assert document["paragraphs"][1] == {
        "id": "p0002",
        "kind": "prose",
        "text": "锦衣纨绔之时。",
    }
    # The glyph image never becomes an illustration; the unmapped one still does.
    assert [item["source_href"] for item in document["illustrations"]] == [
        "EPUB/Images/map.png"
    ]


def test_cli_glyph_map_is_validated(tmp_path: Path, capsys: object) -> None:
    input_path = tmp_path / "book.epub"
    input_path.write_bytes(make_epub())
    glyph_path = tmp_path / "glyphs.json"
    glyph_path.write_text('{"EPUB/Images/glyph.png": ""}', encoding="utf-8")

    exit_code = main(
        [
            str(input_path),
            "--output",
            str(tmp_path / "bundle"),
            "--book-id",
            "glyph-cli",
            "--glyph-map",
            str(glyph_path),
        ]
    )

    assert exit_code == 1
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "must be 1-4 characters" in captured.err
