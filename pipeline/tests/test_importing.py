import hashlib
import json
from pathlib import Path

import pytest
from immersive_reader.importer import main
from immersive_reader.importing import (
    ImportConflictError,
    UnsupportedEncodingError,
    build_source_document,
    detect_and_decode,
    import_txt,
)


def test_build_source_document_splits_blocks_and_classifies_text() -> None:
    source = (
        "示例小说\r\n\r\n"
        "第一章 风来了\r\n\r\n"
        "第一行\r\n仍属于同一段\r\n\r\n"
        "——题记\r\n"
    ).encode()

    document = build_source_document(
        source,
        source_name="example.txt",
        book_id="example-book",
    )

    assert document["title"] == "示例小说"
    assert document["source"] == {
        "format": "txt",
        "path": "source.txt",
        "sha256": hashlib.sha256(source).hexdigest(),
        "encoding": "utf-8",
    }
    assert document["paragraphs"] == [
        {"id": "p0001", "kind": "title", "text": "示例小说"},
        {"id": "p0002", "kind": "chapter_heading", "text": "第一章 风来了"},
        {"id": "p0003", "kind": "prose", "text": "第一行\n仍属于同一段"},
        {"id": "p0004", "kind": "epigraph", "text": "——题记"},
    ]


@pytest.mark.parametrize(
    ("source", "expected_encoding"),
    [
        ("标题\n\n正文".encode("utf-8-sig"), "utf-8-sig"),
        ("标题\n\n正文".encode("utf-16"), "utf-16-le"),
        ("标题\n\n正文".encode("utf-32"), "utf-32-le"),
        ("标题\n\n正文".encode("gb18030"), "gb18030"),
    ],
)
def test_detect_and_decode_supported_chinese_encodings(
    source: bytes,
    expected_encoding: str,
) -> None:
    decoded = detect_and_decode(source)

    assert decoded.text == "标题\n\n正文"
    assert decoded.encoding == expected_encoding


def test_auto_detection_rejects_utf16_without_a_bom() -> None:
    with pytest.raises(UnsupportedEncodingError, match="select the correct encoding"):
        detect_and_decode("标题".encode("utf-16-le"))


def test_no_first_block_title_uses_filename_for_metadata() -> None:
    document = build_source_document(
        "开场正文\n\n下一段".encode(),
        source_name="我的小说.txt",
        book_id="my-book",
        first_block_is_title=False,
    )

    assert document["title"] == "我的小说"
    assert [paragraph["kind"] for paragraph in document["paragraphs"]] == [
        "prose",
        "prose",
    ]


def test_import_is_byte_preserving_and_idempotent(tmp_path: Path) -> None:
    input_path = tmp_path / "novel.txt"
    output_dir = tmp_path / "book"
    source_bytes = "书名\n\n雨开始下了。\n".encode("gb18030")
    input_path.write_bytes(source_bytes)

    first = import_txt(input_path, output_dir, book_id="rain-book")
    first_manifest = first.manifest_path.read_bytes()
    second = import_txt(input_path, output_dir, book_id="rain-book")

    assert first.source_path.read_bytes() == source_bytes
    assert second.manifest_path.read_bytes() == first_manifest
    assert first.sha256 == hashlib.sha256(source_bytes).hexdigest()
    assert first.encoding == "gb18030"
    assert first.paragraph_count == 2


def test_import_refuses_to_replace_a_different_source(tmp_path: Path) -> None:
    input_path = tmp_path / "novel.txt"
    output_dir = tmp_path / "book"
    input_path.write_text("书名\n\n第一版", encoding="utf-8")
    import_txt(input_path, output_dir, book_id="versioned-book")
    input_path.write_text("书名\n\n第二版", encoding="utf-8")

    with pytest.raises(ImportConflictError, match="different identity"):
        import_txt(input_path, output_dir, book_id="versioned-book", revision=2)

    assert (output_dir / "source.txt").read_text(encoding="utf-8").endswith("第一版")


def test_manifest_conflict_is_checked_before_copying_source(tmp_path: Path) -> None:
    input_path = tmp_path / "novel.txt"
    output_dir = tmp_path / "book"
    output_dir.mkdir()
    input_path.write_text("新书\n\n正文", encoding="utf-8")
    (output_dir / "source.json").write_text(
        json.dumps(
            {
                "book_id": "another-book",
                "revision": 1,
                "source": {"sha256": "0" * 64},
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ImportConflictError, match="different identity"):
        import_txt(input_path, output_dir, book_id="new-book")

    assert not (output_dir / "source.txt").exists()


def test_cli_imports_a_txt_bundle(tmp_path: Path, capsys: object) -> None:
    input_path = tmp_path / "story.txt"
    output_dir = tmp_path / "story"
    input_path.write_text("故事\n\n从这里开始。", encoding="utf-8")

    exit_code = main(
        [
            str(input_path),
            "--output",
            str(output_dir),
            "--book-id",
            "cli-story",
        ]
    )

    assert exit_code == 0
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "Imported 2 paragraphs as utf-8" in captured.out
    manifest = json.loads((output_dir / "source.json").read_text(encoding="utf-8"))
    assert manifest["book_id"] == "cli-story"


def test_cli_failure_is_actionable(tmp_path: Path, capsys: object) -> None:
    input_path = tmp_path / "story.md"
    input_path.write_text("不是 TXT", encoding="utf-8")

    exit_code = main(
        [
            str(input_path),
            "--output",
            str(tmp_path / "story"),
            "--book-id",
            "cli-story",
        ]
    )

    assert exit_code == 1
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "supported .txt or .epub extension" in captured.err
