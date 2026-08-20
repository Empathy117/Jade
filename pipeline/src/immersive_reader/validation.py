"""Validation for versioned Reader data bundles."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

JsonObject = dict[str, Any]

DOCUMENT_SCHEMAS = {
    "source.json": "source.schema.json",
    "direction.json": "direction.schema.json",
    "assets.json": "assets.schema.json",
    "playback.json": "playback.schema.json",
}


@dataclass(frozen=True)
class ValidationIssue:
    """One actionable validation failure."""

    document: str
    path: str
    code: str
    message: str

    def __str__(self) -> str:
        return f"{self.document}:{self.path} [{self.code}] {self.message}"


def validate_bundle(
    bundle_dir: Path,
    *,
    contracts_dir: Path | None = None,
) -> list[ValidationIssue]:
    """Validate the four documents and their cross-document invariants."""

    bundle_dir = bundle_dir.resolve()
    contracts_dir = (contracts_dir or Path.cwd() / "contracts").resolve()
    documents: dict[str, JsonObject] = {}
    issues: list[ValidationIssue] = []
    schema_valid_documents: set[str] = set()

    for document_name, schema_name in DOCUMENT_SCHEMAS.items():
        document_path = bundle_dir / document_name
        schema_path = contracts_dir / schema_name
        document = _load_json(document_path, document_name, issues)
        schema = _load_json(schema_path, f"contracts/{schema_name}", issues)
        if document is None or schema is None:
            continue

        documents[document_name] = document
        document_issues = _validate_schema(document_name, document, schema)
        issues.extend(document_issues)
        if not document_issues:
            schema_valid_documents.add(document_name)

    if "source.json" in schema_valid_documents:
        issues.extend(_validate_source(bundle_dir, documents["source.json"]))

    if {"source.json", "direction.json"} <= schema_valid_documents:
        issues.extend(
            _validate_direction(
                documents["source.json"],
                documents["direction.json"],
            )
        )

    if "assets.json" in schema_valid_documents:
        issues.extend(_validate_assets(bundle_dir, documents["assets.json"]))

    if {
        "source.json",
        "direction.json",
        "assets.json",
        "playback.json",
    } <= schema_valid_documents:
        issues.extend(
            _validate_playback(
                documents["source.json"],
                documents["direction.json"],
                documents["assets.json"],
                documents["playback.json"],
            )
        )

    return sorted(
        issues,
        key=lambda issue: (issue.document, issue.path, issue.code, issue.message),
    )


def _load_json(
    path: Path,
    document_name: str,
    issues: list[ValidationIssue],
) -> JsonObject | None:
    if not path.is_file():
        issues.append(
            ValidationIssue(
                document_name,
                "$",
                "file_not_found",
                f"file does not exist: {path}",
            )
        )
        return None

    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        issues.append(
            ValidationIssue(
                document_name,
                "$",
                "invalid_json",
                str(error),
            )
        )
        return None

    if not isinstance(value, dict):
        issues.append(
            ValidationIssue(
                document_name,
                "$",
                "invalid_document",
                "top-level JSON value must be an object",
            )
        )
        return None
    return value


def _validate_schema(
    document_name: str,
    document: JsonObject,
    schema: JsonObject,
) -> list[ValidationIssue]:
    validator = Draft202012Validator(schema)
    return [
        ValidationIssue(
            document_name,
            _error_path(error),
            f"schema_{error.validator}",
            error.message,
        )
        for error in sorted(validator.iter_errors(document), key=_schema_error_key)
    ]


def _schema_error_key(error: ValidationError) -> tuple[str, str]:
    return (_json_path(list(error.absolute_path)), error.message)


def _error_path(error: ValidationError) -> str:
    parts = list(error.absolute_path)
    if error.validator == "required":
        missing = _missing_required_property(error.message)
        if missing is not None:
            parts.append(missing)
    return _json_path(parts)


def _missing_required_property(message: str) -> str | None:
    marker = "' is a required property"
    if marker not in message or not message.startswith("'"):
        return None
    return message[1 : message.index(marker)]


def _json_path(parts: list[Any]) -> str:
    path = "$"
    for part in parts:
        if isinstance(part, int):
            path += f"[{part}]"
        elif isinstance(part, str) and part.replace("_", "").isalnum():
            path += f".{part}"
        else:
            path += f"[{json.dumps(part, ensure_ascii=False)}]"
    return path


def _validate_source(bundle_dir: Path, source: JsonObject) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    paragraphs = source["paragraphs"]
    paragraph_ids: set[str] = set()

    for index, paragraph in enumerate(paragraphs):
        paragraph_id = paragraph["id"]
        if paragraph_id in paragraph_ids:
            issues.append(
                ValidationIssue(
                    "source.json",
                    f"$.paragraphs[{index}].id",
                    "duplicate_paragraph_id",
                    f"paragraph id is already used: {paragraph_id}",
                )
            )
        paragraph_ids.add(paragraph_id)

    illustration_ids: set[str] = set()
    illustration_paths: set[str] = set()
    for index, illustration in enumerate(source.get("illustrations", [])):
        illustration_path = f"$.illustrations[{index}]"
        illustration_id = illustration["id"]
        if illustration_id in illustration_ids:
            issues.append(
                ValidationIssue(
                    "source.json",
                    f"{illustration_path}.id",
                    "duplicate_illustration_id",
                    f"illustration id is already used: {illustration_id}",
                )
            )
        illustration_ids.add(illustration_id)

        if illustration["at"] not in paragraph_ids:
            issues.append(
                ValidationIssue(
                    "source.json",
                    f"{illustration_path}.at",
                    "paragraph_not_found",
                    f"paragraph does not exist: {illustration['at']}",
                )
            )

        relative_path = illustration["path"]
        if relative_path in illustration_paths:
            issues.append(
                ValidationIssue(
                    "source.json",
                    f"{illustration_path}.path",
                    "duplicate_illustration_path",
                    f"illustration path is already used: {relative_path}",
                )
            )
        illustration_paths.add(relative_path)
        file_path = _resolve_relative_path(
            bundle_dir,
            relative_path,
            "source.json",
            f"{illustration_path}.path",
            issues,
        )
        if file_path is None:
            continue
        if not file_path.is_file():
            issues.append(
                ValidationIssue(
                    "source.json",
                    f"{illustration_path}.path",
                    "illustration_file_missing",
                    f"illustration file does not exist: {file_path}",
                )
            )
            continue
        try:
            actual_illustration_hash = _sha256_file(file_path)
        except OSError as error:
            issues.append(
                ValidationIssue(
                    "source.json",
                    f"{illustration_path}.path",
                    "illustration_file_unreadable",
                    str(error),
                )
            )
            continue
        if actual_illustration_hash != illustration["sha256"]:
            issues.append(
                ValidationIssue(
                    "source.json",
                    f"{illustration_path}.sha256",
                    "illustration_hash_mismatch",
                    f"expected {illustration['sha256']}, got {actual_illustration_hash}",
                )
            )

    source_path = _resolve_relative_path(
        bundle_dir,
        source["source"]["path"],
        "source.json",
        "$.source.path",
        issues,
    )
    if source_path is None:
        return issues
    if not source_path.is_file():
        issues.append(
            ValidationIssue(
                "source.json",
                "$.source.path",
                "source_file_missing",
                f"source file does not exist: {source_path}",
            )
        )
        return issues

    try:
        actual_hash = _sha256_file(source_path)
    except OSError as error:
        issues.append(
            ValidationIssue(
                "source.json",
                "$.source.path",
                "source_file_unreadable",
                str(error),
            )
        )
        return issues
    expected_hash = source["source"]["sha256"]
    if actual_hash != expected_hash:
        issues.append(
            ValidationIssue(
                "source.json",
                "$.source.sha256",
                "source_hash_mismatch",
                f"expected {expected_hash}, got {actual_hash}",
            )
        )
    return issues


def _validate_direction(
    source: JsonObject,
    direction: JsonObject,
) -> list[ValidationIssue]:
    issues = _validate_source_identity("direction.json", source, direction)
    scenes = direction["scenes"]
    paragraphs = source["paragraphs"]
    directable = [paragraph["id"] for paragraph in paragraphs if paragraph["kind"] != "title"]
    directable_positions = {paragraph_id: index for index, paragraph_id in enumerate(directable)}
    all_paragraph_ids = {paragraph["id"] for paragraph in paragraphs}
    scene_ids: set[str] = set()
    expected_start = 0

    if not directable:
        issues.append(
            ValidationIssue(
                "direction.json",
                "$.scenes",
                "no_directable_paragraphs",
                "source contains no non-title paragraphs",
            )
        )
        return issues

    for index, scene in enumerate(scenes):
        scene_id = scene["id"]
        if scene_id in scene_ids:
            issues.append(
                ValidationIssue(
                    "direction.json",
                    f"$.scenes[{index}].id",
                    "duplicate_scene_id",
                    f"scene id is already used: {scene_id}",
                )
            )
        scene_ids.add(scene_id)

        start_id = scene["start"]
        end_id = scene["end"]
        boundaries_valid = True
        for field, paragraph_id in (("start", start_id), ("end", end_id)):
            if paragraph_id not in all_paragraph_ids:
                issues.append(
                    ValidationIssue(
                        "direction.json",
                        f"$.scenes[{index}].{field}",
                        "paragraph_not_found",
                        f"paragraph does not exist: {paragraph_id}",
                    )
                )
                boundaries_valid = False
            elif paragraph_id not in directable_positions:
                issues.append(
                    ValidationIssue(
                        "direction.json",
                        f"$.scenes[{index}].{field}",
                        "paragraph_not_directable",
                        f"title paragraph cannot be a scene boundary: {paragraph_id}",
                    )
                )
                boundaries_valid = False

        if not boundaries_valid:
            continue

        start_position = directable_positions[start_id]
        end_position = directable_positions[end_id]
        if end_position < start_position:
            issues.append(
                ValidationIssue(
                    "direction.json",
                    f"$.scenes[{index}].end",
                    "scene_inverted",
                    f"scene ends before it starts: {start_id}..{end_id}",
                )
            )
            continue

        if start_position > expected_start:
            issues.append(
                ValidationIssue(
                    "direction.json",
                    f"$.scenes[{index}].start",
                    "scene_gap",
                    f"expected {directable[expected_start]}, got {start_id}",
                )
            )
        elif start_position < expected_start:
            issues.append(
                ValidationIssue(
                    "direction.json",
                    f"$.scenes[{index}].start",
                    "scene_overlap",
                    f"scene overlaps or is out of order at {start_id}",
                )
            )
        expected_start = max(expected_start, end_position + 1)

    if expected_start < len(directable):
        issues.append(
            ValidationIssue(
                "direction.json",
                "$.scenes",
                "scene_gap",
                f"scenes do not cover final paragraph {directable[-1]}",
            )
        )
    return issues


def _validate_assets(bundle_dir: Path, assets: JsonObject) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    asset_ids: set[str] = set()
    for index, asset in enumerate(assets["assets"]):
        asset_id = asset["id"]
        if asset_id in asset_ids:
            issues.append(
                ValidationIssue(
                    "assets.json",
                    f"$.assets[{index}].id",
                    "duplicate_asset_id",
                    f"asset id is already used: {asset_id}",
                )
            )
        asset_ids.add(asset_id)

        asset_path = _resolve_relative_path(
            bundle_dir,
            asset["path"],
            "assets.json",
            f"$.assets[{index}].path",
            issues,
        )
        if asset_path is not None and not asset_path.is_file():
            issues.append(
                ValidationIssue(
                    "assets.json",
                    f"$.assets[{index}].path",
                    "asset_file_missing",
                    f"asset file does not exist: {asset_path}",
                )
            )
    return issues


def _validate_playback(
    source: JsonObject,
    direction: JsonObject,
    assets: JsonObject,
    playback: JsonObject,
) -> list[ValidationIssue]:
    issues = _validate_source_identity("playback.json", source, playback)
    if playback["asset_catalog_id"] != assets["catalog_id"]:
        issues.append(
            ValidationIssue(
                "playback.json",
                "$.asset_catalog_id",
                "asset_catalog_mismatch",
                f"expected {assets['catalog_id']}, got {playback['asset_catalog_id']}",
            )
        )

    paragraph_positions = {
        paragraph["id"]: index for index, paragraph in enumerate(source["paragraphs"])
    }
    scenes = {scene["id"]: scene for scene in direction["scenes"]}
    asset_types = {asset["id"]: asset["type"] for asset in assets["assets"]}
    previous_position = -1
    seen_cues: set[str] = set()

    for index, cue in enumerate(playback["cues"]):
        cue_path = f"$.cues[{index}]"
        paragraph_id = cue["at"]
        position = paragraph_positions.get(paragraph_id)
        if position is None:
            issues.append(
                ValidationIssue(
                    "playback.json",
                    f"{cue_path}.at",
                    "paragraph_not_found",
                    f"paragraph does not exist: {paragraph_id}",
                )
            )
        else:
            if paragraph_id in seen_cues:
                issues.append(
                    ValidationIssue(
                        "playback.json",
                        f"{cue_path}.at",
                        "duplicate_cue",
                        f"paragraph already has a cue: {paragraph_id}",
                    )
                )
            elif position <= previous_position:
                issues.append(
                    ValidationIssue(
                        "playback.json",
                        f"{cue_path}.at",
                        "cue_out_of_order",
                        f"cue is not in paragraph order: {paragraph_id}",
                    )
                )
            seen_cues.add(paragraph_id)
            previous_position = max(previous_position, position)

        scene_id = cue["scene_id"]
        scene = scenes.get(scene_id)
        if scene is None:
            issues.append(
                ValidationIssue(
                    "playback.json",
                    f"{cue_path}.scene_id",
                    "scene_not_found",
                    f"scene does not exist: {scene_id}",
                )
            )
        elif position is not None:
            scene_start = paragraph_positions.get(scene["start"])
            scene_end = paragraph_positions.get(scene["end"])
            if (
                scene_start is not None
                and scene_end is not None
                and not scene_start <= position <= scene_end
            ):
                issues.append(
                    ValidationIssue(
                        "playback.json",
                        f"{cue_path}.scene_id",
                        "cue_scene_mismatch",
                        f"{paragraph_id} is outside {scene_id} ({scene['start']}..{scene['end']})",
                    )
                )

        background = cue.get("background")
        if background is not None:
            _validate_asset_reference(
                issues,
                asset_types,
                background["asset_id"],
                "background",
                f"{cue_path}.background.asset_id",
            )

        music = cue.get("music")
        if music is not None:
            _validate_asset_reference(
                issues,
                asset_types,
                music["asset_id"],
                "music",
                f"{cue_path}.music.asset_id",
            )

        ambience_ids: set[str] = set()
        for ambience_index, ambience in enumerate(cue.get("ambience", [])):
            asset_id = ambience["asset_id"]
            asset_path = f"{cue_path}.ambience[{ambience_index}].asset_id"
            _validate_asset_reference(
                issues,
                asset_types,
                asset_id,
                "ambience",
                asset_path,
            )
            if asset_id in ambience_ids:
                issues.append(
                    ValidationIssue(
                        "playback.json",
                        asset_path,
                        "duplicate_ambience_asset",
                        f"ambience asset is repeated in one cue: {asset_id}",
                    )
                )
            ambience_ids.add(asset_id)
    return issues


def _validate_source_identity(
    document_name: str,
    source: JsonObject,
    dependent: JsonObject,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    comparisons = (
        ("book_id", source["book_id"], dependent["book_id"]),
        ("source_revision", source["revision"], dependent["source_revision"]),
        ("source_sha256", source["source"]["sha256"], dependent["source_sha256"]),
    )
    for field, expected, actual in comparisons:
        if expected != actual:
            issues.append(
                ValidationIssue(
                    document_name,
                    f"$.{field}",
                    "source_identity_mismatch",
                    f"expected {expected}, got {actual}",
                )
            )
    return issues


def _validate_asset_reference(
    issues: list[ValidationIssue],
    asset_types: dict[str, str],
    asset_id: str,
    expected_type: str,
    path: str,
) -> None:
    actual_type = asset_types.get(asset_id)
    if actual_type is None:
        issues.append(
            ValidationIssue(
                "playback.json",
                path,
                "asset_not_found",
                f"asset does not exist: {asset_id}",
            )
        )
    elif actual_type != expected_type:
        issues.append(
            ValidationIssue(
                "playback.json",
                path,
                "asset_type_mismatch",
                f"expected {expected_type}, got {actual_type}: {asset_id}",
            )
        )


def _resolve_relative_path(
    root: Path,
    relative_path: str,
    document: str,
    path: str,
    issues: list[ValidationIssue],
) -> Path | None:
    resolved_root = root.resolve()
    resolved_path = (resolved_root / relative_path).resolve()
    if not resolved_path.is_relative_to(resolved_root):
        issues.append(
            ValidationIssue(
                document,
                path,
                "path_outside_bundle",
                f"path escapes bundle directory: {relative_path}",
            )
        )
        return None
    return resolved_path


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        for chunk in iter(lambda: source_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
