"""Record the current bytes of every catalogued asset as a `sha256`.

Assets are Director-layer material and may legitimately be replaced, so the
contract keeps `sha256` optional. Once a catalog is happy with its assets this
pins them, and `immersive-reader-validate` then reports any later drift.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from immersive_reader.documents import sha256_file


def hash_bundle_assets(bundle_dir: Path, *, check: bool = False) -> tuple[int, int]:
    """Return the (recorded, changed) asset counts for one bundle.

    With `check`, nothing is written: `changed` counts assets whose stored hash
    is missing or stale.
    """

    catalog_path = bundle_dir / "assets.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))

    recorded = 0
    changed = 0
    for asset in catalog["assets"]:
        asset_path = (bundle_dir / asset["path"]).resolve()
        if not asset_path.is_relative_to(bundle_dir.resolve()):
            raise ValueError(f"asset path escapes the bundle: {asset['path']}")
        if not asset_path.is_file():
            raise FileNotFoundError(f"asset file does not exist: {asset_path}")

        digest = sha256_file(asset_path)
        if asset.get("sha256") != digest:
            changed += 1
            if not check:
                asset["sha256"] = digest
        recorded += 1

    if changed and not check:
        catalog_path.write_text(
            json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return recorded, changed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="immersive-reader-hash-assets",
        description="Record each catalogued asset's sha256 in assets.json.",
    )
    parser.add_argument("bundle", type=Path, help="directory containing assets.json")
    parser.add_argument(
        "--check",
        action="store_true",
        help="report assets whose hash is missing or stale without writing",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        recorded, changed = hash_bundle_assets(args.bundle, check=args.check)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"Could not hash assets: {error}", file=sys.stderr)
        return 1

    if args.check:
        if changed:
            print(
                f"{changed} of {recorded} asset(s) are unhashed or stale in {args.bundle}",
                file=sys.stderr,
            )
            return 1
        print(f"All {recorded} asset(s) match their recorded hash: {args.bundle}")
        return 0

    print(f"Hashed {recorded} asset(s), updated {changed}: {args.bundle}")
    return 0


def entrypoint() -> None:
    raise SystemExit(main())


if __name__ == "__main__":
    entrypoint()
