import hashlib
import json
import shutil
from pathlib import Path

from immersive_reader.asset_hasher import hash_bundle_assets, main
from immersive_reader.validation import validate_bundle

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
VALID_BUNDLE = ROOT / "tests" / "fixtures" / "valid"


def copy_bundle(tmp_path: Path) -> Path:
    bundle = tmp_path / "bundle"
    shutil.copytree(VALID_BUNDLE, bundle)
    return bundle


def load_catalog(bundle: Path) -> dict:
    return json.loads((bundle / "assets.json").read_text(encoding="utf-8"))


def issue_codes(bundle: Path) -> set[str]:
    return {issue.code for issue in validate_bundle(bundle, contracts_dir=CONTRACTS)}


def test_unhashed_assets_are_valid(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)

    assert all("sha256" not in asset for asset in load_catalog(bundle)["assets"])
    assert validate_bundle(bundle, contracts_dir=CONTRACTS) == []


def test_hashing_records_every_asset(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)

    recorded, changed = hash_bundle_assets(bundle)

    catalog = load_catalog(bundle)
    assert recorded == changed == len(catalog["assets"])
    for asset in catalog["assets"]:
        expected = hashlib.sha256((bundle / asset["path"]).read_bytes()).hexdigest()
        assert asset["sha256"] == expected
    assert validate_bundle(bundle, contracts_dir=CONTRACTS) == []


def test_hashing_is_idempotent(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    hash_bundle_assets(bundle)

    recorded, changed = hash_bundle_assets(bundle)

    assert changed == 0
    assert recorded > 0


def test_changed_asset_bytes_are_rejected(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    hash_bundle_assets(bundle)
    first = load_catalog(bundle)["assets"][0]
    (bundle / first["path"]).write_bytes(b"different bytes")

    assert "asset_hash_mismatch" in issue_codes(bundle)


def test_check_reports_stale_hashes_without_writing(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    hash_bundle_assets(bundle)
    first = load_catalog(bundle)["assets"][0]
    (bundle / first["path"]).write_bytes(b"different bytes")
    before = (bundle / "assets.json").read_text(encoding="utf-8")

    recorded, changed = hash_bundle_assets(bundle, check=True)

    assert recorded > 0
    assert changed == 1
    assert (bundle / "assets.json").read_text(encoding="utf-8") == before


def test_cli_reports_a_missing_asset_file(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)
    first = load_catalog(bundle)["assets"][0]
    (bundle / first["path"]).unlink()

    assert main([str(bundle)]) == 1


def test_cli_hashes_and_then_passes_its_own_check(tmp_path: Path) -> None:
    bundle = copy_bundle(tmp_path)

    assert main([str(bundle)]) == 0
    assert main([str(bundle), "--check"]) == 0
