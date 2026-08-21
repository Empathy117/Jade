"""Validation for versioned Reader data bundles."""

from __future__ import annotations

from pathlib import Path

from immersive_reader.documents import (
    JsonObject,
    ValidationIssue,
    issue_key,
    load_json_object,
    resolve_inside,
    schema_issues,
    sha256_file,
)

__all__ = ["JsonObject", "ValidationIssue", "validate_bundle"]

DOCUMENT_SCHEMAS = {
    "source.json": "source.schema.json",
    "direction.json": "direction.schema.json",
    "assets.json": "assets.schema.json",
    "playback.json": "playback.schema.json",
}

OPTIONAL_DOCUMENT_SCHEMAS = {
    "guide.json": "guide.schema.json",
    "codex.json": "codex.schema.json",
}


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
        document = load_json_object(document_path, document_name, issues)
        schema = load_json_object(schema_path, f"contracts/{schema_name}", issues)
        if document is None or schema is None:
            continue

        documents[document_name] = document
        document_issues = schema_issues(document_name, document, schema)
        issues.extend(document_issues)
        if not document_issues:
            schema_valid_documents.add(document_name)

    for document_name, schema_name in OPTIONAL_DOCUMENT_SCHEMAS.items():
        document_path = bundle_dir / document_name
        if not document_path.exists():
            continue
        schema_path = contracts_dir / schema_name
        document = load_json_object(document_path, document_name, issues)
        schema = load_json_object(schema_path, f"contracts/{schema_name}", issues)
        if document is None or schema is None:
            continue
        documents[document_name] = document
        document_issues = schema_issues(document_name, document, schema)
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

    if {"source.json", "guide.json"} <= schema_valid_documents:
        issues.extend(_validate_guide(documents["source.json"], documents["guide.json"]))

    if {"source.json", "codex.json"} <= schema_valid_documents:
        issues.extend(
            _validate_codex(
                bundle_dir,
                documents["source.json"],
                documents["codex.json"],
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

    return sorted(issues, key=issue_key)


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
        file_path = _resolve_in_bundle(
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
            actual_illustration_hash = sha256_file(file_path)
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

    source_path = _resolve_in_bundle(
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
        actual_hash = sha256_file(source_path)
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
    directable_positions = {
        paragraph_id: index for index, paragraph_id in enumerate(directable)
    }
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


def _validate_guide(source: JsonObject, guide: JsonObject) -> list[ValidationIssue]:
    issues = _validate_source_identity("guide.json", source, guide)
    paragraphs = {paragraph["id"]: paragraph for paragraph in source["paragraphs"]}
    start_at = guide.get("start_at")
    if start_at is not None:
        paragraph = paragraphs.get(start_at)
        if paragraph is None:
            issues.append(
                ValidationIssue(
                    "guide.json",
                    "$.start_at",
                    "paragraph_not_found",
                    f"paragraph does not exist: {start_at}",
                )
            )
        elif paragraph["kind"] == "title":
            issues.append(
                ValidationIssue(
                    "guide.json",
                    "$.start_at",
                    "paragraph_not_readable",
                    f"title paragraph cannot be the preferred reading start: {start_at}",
                )
            )

    illustrations = {
        illustration["id"]: illustration
        for illustration in source.get("illustrations", [])
    }
    reference_ids: set[str] = set()
    selected_illustrations: set[str] = set()
    for index, reference in enumerate(guide.get("references", [])):
        reference_path = f"$.references[{index}]"
        reference_id = reference["id"]
        if reference_id in reference_ids:
            issues.append(
                ValidationIssue(
                    "guide.json",
                    f"{reference_path}.id",
                    "duplicate_reference_id",
                    f"reference id is already used: {reference_id}",
                )
            )
        reference_ids.add(reference_id)

        illustration_id = reference["illustration_id"]
        if illustration_id not in illustrations:
            issues.append(
                ValidationIssue(
                    "guide.json",
                    f"{reference_path}.illustration_id",
                    "illustration_not_found",
                    f"source illustration does not exist: {illustration_id}",
                )
            )
        elif illustration_id in selected_illustrations:
            issues.append(
                ValidationIssue(
                    "guide.json",
                    f"{reference_path}.illustration_id",
                    "duplicate_reference_illustration",
                    f"illustration is selected more than once: {illustration_id}",
                )
            )
        selected_illustrations.add(illustration_id)
    return issues


def _validate_codex(
    bundle_dir: Path,
    source: JsonObject,
    codex: JsonObject,
) -> list[ValidationIssue]:
    issues = _validate_source_identity("codex.json", source, codex)
    paragraph_ids = {paragraph["id"] for paragraph in source["paragraphs"]}
    illustration_ids = {
        illustration["id"] for illustration in source.get("illustrations", [])
    }

    def check_anchor(paragraph_id: str, path: str) -> None:
        if paragraph_id not in paragraph_ids:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    path,
                    "paragraph_not_found",
                    f"paragraph does not exist: {paragraph_id}",
                )
            )

    character_ids: set[str] = set()
    for index, character in enumerate(codex.get("characters", [])):
        character_path = f"$.characters[{index}]"
        character_id = character["id"]
        if character_id in character_ids:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    f"{character_path}.id",
                    "duplicate_character_id",
                    f"character id is already used: {character_id}",
                )
            )
        character_ids.add(character_id)
        check_anchor(character["at"], f"{character_path}.at")
        for alias_index, alias in enumerate(character.get("aliases", [])):
            check_anchor(alias["at"], f"{character_path}.aliases[{alias_index}].at")
        for fact_index, fact in enumerate(character.get("facts", [])):
            check_anchor(fact["at"], f"{character_path}.facts[{fact_index}].at")
        for status_index, status in enumerate(character.get("status", [])):
            check_anchor(status["at"], f"{character_path}.status[{status_index}].at")

    def check_character(character_id: str, path: str) -> None:
        if character_id not in character_ids:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    path,
                    "character_not_found",
                    f"character does not exist: {character_id}",
                )
            )

    seen_relationships: set[tuple[str, str, str]] = set()
    for index, relationship in enumerate(codex.get("relationships", [])):
        relationship_path = f"$.relationships[{index}]"
        check_character(relationship["a"], f"{relationship_path}.a")
        check_character(relationship["b"], f"{relationship_path}.b")
        check_anchor(relationship["at"], f"{relationship_path}.at")
        if relationship["a"] == relationship["b"]:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    f"{relationship_path}.b",
                    "relationship_self",
                    f"relationship links a character to itself: {relationship['a']}",
                )
            )
        key = (relationship["a"], relationship["b"], relationship["kind"])
        if key in seen_relationships:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    f"{relationship_path}.kind",
                    "duplicate_relationship",
                    f"relationship is already declared: {' '.join(key)}",
                )
            )
        seen_relationships.add(key)

    tree_ids: set[str] = set()
    for index, tree in enumerate(codex.get("trees", [])):
        tree_path = f"$.trees[{index}]"
        tree_id = tree["id"]
        if tree_id in tree_ids:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    f"{tree_path}.id",
                    "duplicate_tree_id",
                    f"tree id is already used: {tree_id}",
                )
            )
        tree_ids.add(tree_id)
        check_anchor(tree["at"], f"{tree_path}.at")
        node_characters: set[str] = set()
        node_cells: set[tuple[int, int]] = set()
        for node_index, node in enumerate(tree["nodes"]):
            node_path = f"{tree_path}.nodes[{node_index}]"
            check_character(node["character_id"], f"{node_path}.character_id")
            if node["character_id"] in node_characters:
                issues.append(
                    ValidationIssue(
                        "codex.json",
                        f"{node_path}.character_id",
                        "duplicate_tree_character",
                        f"character appears twice in one tree: {node['character_id']}",
                    )
                )
            node_characters.add(node["character_id"])
            cell = (node["row"], node["col"])
            if cell in node_cells:
                issues.append(
                    ValidationIssue(
                        "codex.json",
                        f"{node_path}.col",
                        "tree_cell_occupied",
                        f"tree cell is already occupied: row {cell[0]}, col {cell[1]}",
                    )
                )
            node_cells.add(cell)

    place_ids: set[str] = set()
    place_parents: dict[str, str] = {}
    for index, place in enumerate(codex.get("places", [])):
        place_path = f"$.places[{index}]"
        place_id = place["id"]
        if place_id in place_ids:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    f"{place_path}.id",
                    "duplicate_place_id",
                    f"place id is already used: {place_id}",
                )
            )
        place_ids.add(place_id)
        check_anchor(place["at"], f"{place_path}.at")
        for fact_index, fact in enumerate(place.get("facts", [])):
            check_anchor(fact["at"], f"{place_path}.facts[{fact_index}].at")
        if "parent" in place:
            place_parents[place_id] = place["parent"]

    for index, place in enumerate(codex.get("places", [])):
        parent = place.get("parent")
        if parent is None:
            continue
        place_path = f"$.places[{index}].parent"
        if parent not in place_ids:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    place_path,
                    "place_not_found",
                    f"parent place does not exist: {parent}",
                )
            )
            continue
        visited = {place["id"]}
        cursor: str | None = parent
        while cursor is not None:
            if cursor in visited:
                issues.append(
                    ValidationIssue(
                        "codex.json",
                        place_path,
                        "place_parent_cycle",
                        f"place parents form a cycle at: {place['id']}",
                    )
                )
                break
            visited.add(cursor)
            cursor = place_parents.get(cursor)

    map_ids: set[str] = set()
    for index, map_document in enumerate(codex.get("maps", [])):
        map_path = f"$.maps[{index}]"
        map_id = map_document["id"]
        if map_id in map_ids:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    f"{map_path}.id",
                    "duplicate_map_id",
                    f"map id is already used: {map_id}",
                )
            )
        map_ids.add(map_id)
        check_anchor(map_document["at"], f"{map_path}.at")

        illustration_id = map_document.get("source_illustration_id")
        if illustration_id is not None and illustration_id not in illustration_ids:
            issues.append(
                ValidationIssue(
                    "codex.json",
                    f"{map_path}.source_illustration_id",
                    "illustration_not_found",
                    f"source illustration does not exist: {illustration_id}",
                )
            )

        image_path = _resolve_in_bundle(
            bundle_dir,
            map_document["image"],
            "codex.json",
            f"{map_path}.image",
            issues,
        )
        if image_path is not None and not image_path.is_file():
            issues.append(
                ValidationIssue(
                    "codex.json",
                    f"{map_path}.image",
                    "map_image_missing",
                    f"map image does not exist: {image_path}",
                )
            )

        marker_places: set[str] = set()
        for marker_index, marker in enumerate(map_document["markers"]):
            marker_path = f"{map_path}.markers[{marker_index}]"
            place_id = marker["place_id"]
            if place_id not in place_ids:
                issues.append(
                    ValidationIssue(
                        "codex.json",
                        f"{marker_path}.place_id",
                        "place_not_found",
                        f"place does not exist: {place_id}",
                    )
                )
            if place_id in marker_places:
                issues.append(
                    ValidationIssue(
                        "codex.json",
                        f"{marker_path}.place_id",
                        "duplicate_map_marker",
                        f"place is marked twice on one map: {place_id}",
                    )
                )
            marker_places.add(place_id)
            if marker["x"] > map_document["width"] or marker["y"] > map_document["height"]:
                issues.append(
                    ValidationIssue(
                        "codex.json",
                        marker_path,
                        "marker_outside_map",
                        f"marker lies outside the map canvas: {place_id}",
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

        asset_path = _resolve_in_bundle(
            bundle_dir,
            asset["path"],
            "assets.json",
            f"$.assets[{index}].path",
            issues,
        )
        if asset_path is None:
            continue
        if not asset_path.is_file():
            issues.append(
                ValidationIssue(
                    "assets.json",
                    f"$.assets[{index}].path",
                    "asset_file_missing",
                    f"asset file does not exist: {asset_path}",
                )
            )
            continue

        issues.extend(_validate_asset_integrity(asset, asset_path, index))
    return issues


def _validate_asset_integrity(
    asset: JsonObject,
    asset_path: Path,
    index: int,
) -> list[ValidationIssue]:
    """Check an asset against its recorded hash, when it records one.

    Assets belong to the mutable Director layer, so `sha256` is optional: a
    catalog may pin a file it wants to keep byte-identical without forcing every
    asset to be pinned.
    """

    expected = asset.get("sha256")
    if expected is None:
        return []

    try:
        actual = sha256_file(asset_path)
    except OSError as error:
        return [
            ValidationIssue(
                "assets.json",
                f"$.assets[{index}].path",
                "asset_file_unreadable",
                str(error),
            )
        ]

    if actual != expected:
        return [
            ValidationIssue(
                "assets.json",
                f"$.assets[{index}].sha256",
                "asset_hash_mismatch",
                f"expected {expected}, got {actual}",
            )
        ]
    return []


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
                        f"{paragraph_id} is outside {scene_id} "
                        f"({scene['start']}..{scene['end']})",
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


def _resolve_in_bundle(
    root: Path,
    relative_path: str,
    document: str,
    path: str,
    issues: list[ValidationIssue],
) -> Path | None:
    return resolve_inside(
        root,
        relative_path,
        document,
        path,
        issues,
        code="path_outside_bundle",
        escape_message="path escapes bundle directory",
    )
