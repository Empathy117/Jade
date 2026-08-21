import hashlib
import json
import shutil
from pathlib import Path

from immersive_reader.validation import ValidationIssue, validate_bundle
from immersive_reader.validator import main

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
VALID_BUNDLE = ROOT / "tests" / "fixtures" / "valid"
INVALID_FIXTURES = ROOT / "tests" / "fixtures" / "invalid"


def issue_codes(issues: list[ValidationIssue]) -> set[str]:
    return {issue.code for issue in issues}


def copy_bundle(tmp_path: Path) -> Path:
    bundle = tmp_path / "bundle"
    shutil.copytree(VALID_BUNDLE, bundle)
    return bundle


def replace_json(bundle: Path, name: str, replacement: Path) -> None:
    shutil.copyfile(replacement, bundle / name)


def load_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, object]) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def test_valid_bundle_has_no_issues() -> None:
    assert validate_bundle(VALID_BUNDLE, contracts_dir=CONTRACTS) == []


def test_schema_error_reports_document_and_json_path(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    replace_json(
        bundle,
        "direction.json",
        INVALID_FIXTURES / "direction-missing-start.json",
    )

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert any(
        issue.document == "direction.json"
        and issue.path == "$.scenes[0].start"
        and issue.code == "schema_required"
        for issue in issues
    )


def test_scene_gap_is_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    replace_json(
        bundle,
        "direction.json",
        INVALID_FIXTURES / "direction-scene-gap.json",
    )

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "scene_gap" in issue_codes(issues)
    assert any(issue.path == "$.scenes[1].start" for issue in issues)


def test_scene_overlap_is_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    direction_path = bundle / "direction.json"
    direction = load_json(direction_path)
    direction["scenes"][1]["start"] = "p0003"  # type: ignore[index]
    write_json(direction_path, direction)

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "scene_overlap" in issue_codes(issues)


def test_missing_paragraph_reference_is_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    direction_path = bundle / "direction.json"
    direction = load_json(direction_path)
    direction["scenes"][1]["end"] = "p9999"  # type: ignore[index]
    write_json(direction_path, direction)

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "paragraph_not_found" in issue_codes(issues)
    assert any(issue.path == "$.scenes[1].end" for issue in issues)


def test_unknown_playback_asset_is_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    replace_json(
        bundle,
        "playback.json",
        INVALID_FIXTURES / "playback-unknown-asset.json",
    )

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert any(
        issue.code == "asset_not_found"
        and issue.path == "$.cues[0].background.asset_id"
        for issue in issues
    )


def test_wrong_playback_asset_type_is_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    playback_path = bundle / "playback.json"
    playback = load_json(playback_path)
    playback["cues"][0]["background"]["asset_id"] = "bgm_quiet"  # type: ignore[index]
    write_json(playback_path, playback)

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "asset_type_mismatch" in issue_codes(issues)


def test_source_hash_mismatch_is_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    with (bundle / "source.txt").open("a", encoding="utf-8") as source_file:
        source_file.write("已被修改。\n")

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "source_hash_mismatch" in issue_codes(issues)


def test_source_illustration_file_and_hash_are_validated(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    illustration_bytes = b"fixture illustration"
    illustration_path = bundle / "source-assets" / "illustration-0001.png"
    illustration_path.parent.mkdir()
    illustration_path.write_bytes(illustration_bytes)
    source_path = bundle / "source.json"
    source = load_json(source_path)
    source["illustrations"] = [
        {
            "id": "ill0001",
            "at": "p0002",
            "title": "测试地图",
            "path": "source-assets/illustration-0001.png",
            "media_type": "image/png",
            "sha256": hashlib.sha256(illustration_bytes).hexdigest(),
            "source_href": "images/map.png",
        }
    ]
    write_json(source_path, source)

    assert validate_bundle(bundle, contracts_dir=CONTRACTS) == []

    illustration_path.write_bytes(b"changed")
    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "illustration_hash_mismatch" in issue_codes(issues)


def test_missing_asset_file_is_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    (bundle / "assets" / "music" / "quiet.fixture").unlink()

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "asset_file_missing" in issue_codes(issues)


def test_source_identity_mismatch_is_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    playback_path = bundle / "playback.json"
    playback = load_json(playback_path)
    playback["source_revision"] = 2
    write_json(playback_path, playback)

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "source_identity_mismatch" in issue_codes(issues)


def test_optional_guide_preferred_start_is_validated(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    source = load_json(bundle / "source.json")
    write_json(
        bundle / "guide.json",
        {
            "schema_version": 1,
            "book_id": source["book_id"],
            "source_revision": source["revision"],
            "source_sha256": source["source"]["sha256"],  # type: ignore[index]
            "start_at": "p0002",
        },
    )

    assert validate_bundle(bundle, contracts_dir=CONTRACTS) == []

    guide = load_json(bundle / "guide.json")
    guide["start_at"] = "p0001"
    write_json(bundle / "guide.json", guide)

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)
    assert "paragraph_not_readable" in issue_codes(issues)


def test_guide_reference_must_select_a_source_illustration(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    source = load_json(bundle / "source.json")
    write_json(
        bundle / "guide.json",
        {
            "schema_version": 1,
            "book_id": source["book_id"],
            "source_revision": source["revision"],
            "source_sha256": source["source"]["sha256"],  # type: ignore[index]
            "references": [
                {
                    "id": "ref_map",
                    "illustration_id": "ill0001",
                    "title": "地图",
                }
            ],
        },
    )

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "illustration_not_found" in issue_codes(issues)


def make_codex(source: dict[str, object]) -> dict[str, object]:
    """A codex exercising every section against the valid fixture bundle."""

    return {
        "schema_version": 1,
        "book_id": source["book_id"],
        "source_revision": source["revision"],
        "source_sha256": source["source"]["sha256"],  # type: ignore[index]
        "characters": [
            {
                "id": "char_ada",
                "name": "艾达",
                "at": "p0002",
                "role": "领航员",
                "group": "旅人",
                "aliases": [{"name": "小艾", "at": "p0003"}],
                "facts": [{"text": "住在山林深处。", "at": "p0003"}],
                "status": [{"label": "失踪", "kind": "missing", "at": "p0004"}],
            },
            {"id": "char_bo", "name": "博", "at": "p0003"},
        ],
        "relationships": [
            {"a": "char_ada", "b": "char_bo", "kind": "parent", "label": "母子", "at": "p0003"},
        ],
        "trees": [
            {
                "id": "tree_family",
                "title": "家族",
                "at": "p0002",
                "nodes": [
                    {"character_id": "char_ada", "row": 0, "col": 0},
                    {"character_id": "char_bo", "row": 1, "col": 0},
                ],
            }
        ],
        "places": [
            {
                "id": "mountain_forest",
                "name": "山林",
                "at": "p0002",
                "facts": [{"text": "常年多雾。", "at": "p0003"}],
            },
            {"id": "cabin", "name": "小屋", "parent": "mountain_forest", "at": "p0003"},
        ],
        "maps": [
            {
                "id": "map_forest",
                "title": "山林图",
                "at": "p0004",
                "image": "codex-assets/map-forest.svg",
                "width": 100,
                "height": 80,
                "markers": [{"place_id": "cabin", "x": 10, "y": 20}],
            }
        ],
    }


def write_codex_bundle(bundle: Path) -> dict[str, object]:
    source = load_json(bundle / "source.json")
    codex = make_codex(source)
    write_json(bundle / "codex.json", codex)
    image = bundle / "codex-assets" / "map-forest.svg"
    image.parent.mkdir(parents=True, exist_ok=True)
    image.write_text("<svg xmlns='http://www.w3.org/2000/svg'/>", encoding="utf-8")
    return codex


def test_optional_codex_valid_document_passes(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    write_codex_bundle(bundle)

    assert validate_bundle(bundle, contracts_dir=CONTRACTS) == []


def test_codex_cross_references_are_validated(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    codex = write_codex_bundle(bundle)

    codex["relationships"] = [
        {"a": "char_ada", "b": "char_ada", "kind": "spouse", "at": "p0002"},
        {"a": "char_ada", "b": "char_ghost", "kind": "parent", "at": "p0002"},
        {"a": "char_ada", "b": "char_bo", "kind": "parent", "at": "p0002"},
        {"a": "char_ada", "b": "char_bo", "kind": "parent", "at": "p0003"},
    ]
    codex["trees"] = [
        {
            "id": "tree_family",
            "title": "家族",
            "at": "p0002",
            "nodes": [
                {"character_id": "char_ada", "row": 0, "col": 0},
                {"character_id": "char_ada", "row": 0, "col": 0},
            ],
        }
    ]
    codex["places"] = [
        {"id": "mountain_forest", "name": "山林", "parent": "cabin", "at": "p0002"},
        {"id": "cabin", "name": "小屋", "parent": "mountain_forest", "at": "p0003"},
    ]
    codex["maps"] = [
        {
            "id": "map_forest",
            "title": "山林图",
            "at": "p0004",
            "image": "codex-assets/missing.svg",
            "width": 100,
            "height": 80,
            "source_illustration_id": "ill0001",
            "markers": [
                {"place_id": "nowhere", "x": 10, "y": 20},
                {"place_id": "cabin", "x": 120, "y": 20},
            ],
        }
    ]
    write_json(bundle / "codex.json", codex)

    codes = issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))

    assert {
        "relationship_self",
        "character_not_found",
        "duplicate_relationship",
        "duplicate_tree_character",
        "tree_cell_occupied",
        "place_parent_cycle",
        "map_image_missing",
        "illustration_not_found",
        "place_not_found",
        "marker_outside_map",
    } <= codes


def test_codex_anchor_and_identity_are_validated(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    codex = write_codex_bundle(bundle)

    codex["source_revision"] = 99
    codex["characters"][0]["status"][0]["at"] = "p9999"  # type: ignore[index]
    write_json(bundle / "codex.json", codex)

    issues = validate_bundle(bundle, contracts_dir=CONTRACTS)

    assert "source_identity_mismatch" in issue_codes(issues)
    assert any(
        issue.code == "paragraph_not_found"
        and issue.path == "$.characters[0].status[0].at"
        for issue in issues
    )


def test_cli_succeeds_for_valid_bundle(capsys: object) -> None:
    exit_code = main([str(VALID_BUNDLE), "--contracts", str(CONTRACTS)])

    assert exit_code == 0
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "Validated bundle" in captured.out


def test_cli_failure_is_actionable(tmp_path: Path, capsys: object) -> None:
    bundle = copy_bundle(tmp_path)
    replace_json(
        bundle,
        "playback.json",
        INVALID_FIXTURES / "playback-unknown-asset.json",
    )

    exit_code = main([str(bundle), "--contracts", str(CONTRACTS)])

    assert exit_code == 1
    captured = capsys.readouterr()  # type: ignore[attr-defined]
    assert "playback.json:$.cues[0].background.asset_id" in captured.err
    assert "[asset_not_found]" in captured.err
