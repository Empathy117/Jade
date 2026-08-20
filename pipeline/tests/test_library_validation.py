import json
import shutil
from pathlib import Path

from immersive_reader.library_validation import validate_library
from immersive_reader.library_validator import main


ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
VALID_BUNDLE = ROOT / "tests" / "fixtures" / "valid"


def write_json(path: Path, value: dict[str, object]) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def create_library(tmp_path: Path) -> Path:
    library_root = tmp_path / "books"
    bundle = library_root / "fixture"
    library_root.mkdir()
    shutil.copytree(VALID_BUNDLE, bundle)
    library_path = library_root / "library.json"
    write_json(
        library_path,
        {
            "schema_version": 1,
            "books": [
                {
                    "book_id": "fixture-book",
                    "path": "fixture",
                    "title": "测试之书",
                    "author": None,
                    "summary": "用于验证书库的数据。",
                    "cover": "assets/backgrounds/forest-rain.fixture",
                    "source_revision": 1,
                    "paragraph_count": 4,
                    "production": "manual",
                }
            ],
        },
    )
    return library_path


def load_library(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def test_valid_library_and_registered_bundle_have_no_issues(tmp_path: Path) -> None:
    library = create_library(tmp_path)

    assert validate_library(library, contracts_dir=CONTRACTS) == []


def test_library_metadata_must_match_source(tmp_path: Path) -> None:
    library = create_library(tmp_path)
    document = load_library(library)
    document["books"][0]["paragraph_count"] = 99  # type: ignore[index]
    write_json(library, document)

    issues = validate_library(library, contracts_dir=CONTRACTS)

    assert any(
        issue.code == "library_source_mismatch"
        and issue.path == "$.books[0].paragraph_count"
        for issue in issues
    )


def test_duplicate_book_registration_is_rejected(tmp_path: Path) -> None:
    library = create_library(tmp_path)
    document = load_library(library)
    document["books"].append(dict(document["books"][0]))  # type: ignore[union-attr,index]
    write_json(library, document)

    issues = validate_library(library, contracts_dir=CONTRACTS)

    assert {issue.code for issue in issues} >= {
        "duplicate_book_id",
        "duplicate_book_path",
    }


def test_missing_cover_is_rejected(tmp_path: Path) -> None:
    library = create_library(tmp_path)
    document = load_library(library)
    document["books"][0]["cover"] = "assets/backgrounds/missing.png"  # type: ignore[index]
    write_json(library, document)

    issues = validate_library(library, contracts_dir=CONTRACTS)

    assert any(issue.code == "cover_file_missing" for issue in issues)


def test_bundle_validation_errors_include_book_path(tmp_path: Path) -> None:
    library = create_library(tmp_path)
    (library.parent / "fixture" / "assets" / "music" / "quiet.fixture").unlink()

    issues = validate_library(library, contracts_dir=CONTRACTS)

    assert any(
        issue.document == "fixture/assets.json"
        and issue.code == "asset_file_missing"
        for issue in issues
    )


def test_library_cli_succeeds(tmp_path: Path, capsys: object) -> None:
    library = create_library(tmp_path)

    exit_code = main([str(library), "--contracts", str(CONTRACTS)])

    assert exit_code == 0
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "Validated library" in captured.out


def test_library_cli_reports_actionable_failure(tmp_path: Path, capsys: object) -> None:
    library = create_library(tmp_path)
    document = load_library(library)
    document["books"][0]["title"] = "错误标题"  # type: ignore[index]
    write_json(library, document)

    exit_code = main([str(library), "--contracts", str(CONTRACTS)])

    assert exit_code == 1
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "library.json:$.books[0].title" in captured.err
    assert "[library_source_mismatch]" in captured.err
