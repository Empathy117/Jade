"""Cross-document rules for v2 staging: shots, key moments, grades, and camera.

JSON Schema already checks shape and the v1/v2 field gate. The rules here need
more than one document, or encode the restraint budget from ADR-0004.
"""

from __future__ import annotations

from immersive_reader.documents import JsonObject, ValidationIssue

MAX_MOMENTS_PER_CHAPTER = 2
MIN_PARAGRAPHS_BETWEEN_MOMENTS = 40
MAX_FLASH_CUTS_PER_BOOK = 1
PARAGRAPHS_PER_SHOT = 3
# Scale a background may be pushed to when its catalog entry records no
# headroom: enough for a gentle drift or a medium framing, not a close-up.
DEFAULT_SCALE_HEADROOM = 1.2

REQUIRED_MOMENT_PARAMS = {
    "letterbox_hold": ("letterbox",),
    "isolate_line": ("dim",),
    "silence": ("music_gain",),
    "grade_shift": ("grade",),
    "flash_cut": ("flash",),
    "slow_reveal": (),
}

Position = tuple[int, int]


def validate_direction_staging(
    source: JsonObject,
    direction: JsonObject,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    paragraphs = source["paragraphs"]
    positions = {paragraph["id"]: index for index, paragraph in enumerate(paragraphs)}
    grades = set(direction.get("grades", {}))

    def issue(path: str, code: str, message: str) -> None:
        issues.append(ValidationIssue("direction.json", path, code, message))

    for scene_index, scene in enumerate(direction["scenes"]):
        scene_path = f"$.scenes[{scene_index}]"
        grade = scene.get("grade")
        if grade is not None and grade not in grades:
            issue(f"{scene_path}.grade", "grade_not_found", f"grade is not defined: {grade}")

        shots = scene.get("shots", [])
        start = positions.get(scene["start"])
        end = positions.get(scene["end"])
        if start is None or end is None:
            continue

        budget = max(1, -(-(end - start + 1) // PARAGRAPHS_PER_SHOT))
        if len(shots) > budget:
            issue(
                f"{scene_path}.shots",
                "shot_budget_exceeded",
                f"{len(shots)} shots over {end - start + 1} paragraphs; "
                f"at most {budget} allowed",
            )

        previous: Position | None = None
        for shot_index, shot in enumerate(shots):
            shot_path = f"{scene_path}.shots[{shot_index}]"
            position = positions.get(shot["at"])
            if position is None:
                issue(
                    f"{shot_path}.at",
                    "paragraph_not_found",
                    f"paragraph does not exist: {shot['at']}",
                )
                continue
            if not start <= position <= end:
                issue(
                    f"{shot_path}.at",
                    "shot_outside_scene",
                    f"{shot['at']} is outside {scene['id']} ({scene['start']}..{scene['end']})",
                )
            key = (position, shot.get("beat", 0))
            if previous is not None and key <= previous:
                issue(
                    f"{shot_path}.at",
                    "shot_out_of_order",
                    f"shot is not after the previous shot: {shot['at']}",
                )
            previous = key

    moments = direction.get("moments", [])
    chapter_of = _chapter_starts(paragraphs)
    moment_ids: set[str] = set()
    per_chapter: dict[int, int] = {}
    flash_cuts = 0
    previous_moment: tuple[Position, str] | None = None

    for index, moment in enumerate(moments):
        path = f"$.moments[{index}]"
        if moment["id"] in moment_ids:
            issue(
                f"{path}.id",
                "duplicate_moment_id",
                f"moment id is already used: {moment['id']}",
            )
        moment_ids.add(moment["id"])

        grade = moment.get("grade")
        if grade is not None and grade not in grades:
            issue(f"{path}.grade", "grade_not_found", f"grade is not defined: {grade}")

        if moment["template"] == "flash_cut":
            flash_cuts += 1
            if flash_cuts > MAX_FLASH_CUTS_PER_BOOK:
                issue(
                    f"{path}.template",
                    "flash_cut_budget_exceeded",
                    f"at most {MAX_FLASH_CUTS_PER_BOOK} flash_cut per book",
                )

        position = positions.get(moment["at"])
        if position is None:
            issue(
                f"{path}.at", "paragraph_not_found", f"paragraph does not exist: {moment['at']}"
            )
            continue
        if paragraphs[position]["kind"] == "title":
            issue(
                f"{path}.at",
                "paragraph_not_directable",
                f"title paragraph cannot carry a moment: {moment['at']}",
            )

        key = (position, moment.get("beat", 0))
        if previous_moment is not None:
            previous_key, previous_id = previous_moment
            if key <= previous_key:
                issue(f"{path}.at", "moment_out_of_order", f"moment is not after {previous_id}")
            elif position - previous_key[0] < MIN_PARAGRAPHS_BETWEEN_MOMENTS:
                issue(
                    f"{path}.at",
                    "moments_too_close",
                    f"{position - previous_key[0]} paragraphs after {previous_id}; "
                    f"at least {MIN_PARAGRAPHS_BETWEEN_MOMENTS} required",
                )
        previous_moment = (key, moment["id"])

        chapter = chapter_of[position]
        per_chapter[chapter] = per_chapter.get(chapter, 0) + 1
        if per_chapter[chapter] > MAX_MOMENTS_PER_CHAPTER:
            issue(
                f"{path}.at",
                "moment_budget_exceeded",
                f"more than {MAX_MOMENTS_PER_CHAPTER} moments in the chapter "
                f"starting at {paragraphs[chapter]['id']}",
            )
    return issues


def validate_playback_staging(
    source: JsonObject,
    direction: JsonObject,
    assets: JsonObject,
    playback: JsonObject,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    positions = {paragraph["id"]: index for index, paragraph in enumerate(source["paragraphs"])}
    catalog = {asset["id"]: asset for asset in assets["assets"]}
    backgrounds = _background_timeline(positions, playback)

    def issue(document: str, path: str, code: str, message: str) -> None:
        issues.append(ValidationIssue(document, path, code, message))

    if direction["schema_version"] != playback["schema_version"]:
        issue(
            "playback.json",
            "$.schema_version",
            "staging_version_mismatch",
            f"direction is v{direction['schema_version']}, "
            f"playback is v{playback['schema_version']}",
        )

    # A shot's focus must name a focal point on whichever background is showing.
    for scene_index, scene in enumerate(direction["scenes"]):
        for shot_index, shot in enumerate(scene.get("shots", [])):
            focus = shot.get("focus")
            position = positions.get(shot["at"])
            if focus is None or position is None:
                continue
            asset_id = _background_at(backgrounds, position)
            focal_points = catalog.get(asset_id, {}).get("focal_points", {})
            if focus not in focal_points:
                issue(
                    "direction.json",
                    f"$.scenes[{scene_index}].shots[{shot_index}].focus",
                    "focus_not_found",
                    f"background {asset_id} has no focal point {focus!r}",
                )

    previous: Position | None = None
    for index, key in enumerate(playback.get("camera", [])):
        path = f"$.camera[{index}]"
        position = positions.get(key["at"])
        if position is None:
            issue(
                "playback.json",
                f"{path}.at",
                "paragraph_not_found",
                f"paragraph does not exist: {key['at']}",
            )
            continue
        order = (position, key.get("beat", 0))
        if previous is not None and order <= previous:
            issue(
                "playback.json",
                f"{path}.at",
                "camera_out_of_order",
                f"camera key is not after the previous key: {key['at']}",
            )
        previous = order

        asset_id = _background_at(backgrounds, position)
        if asset_id is None:
            issue(
                "playback.json",
                path,
                "camera_without_background",
                f"no background is showing at {key['at']}",
            )
            continue
        headroom = catalog.get(asset_id, {}).get("min_scale_headroom", DEFAULT_SCALE_HEADROOM)
        if key["scale"] > headroom:
            issue(
                "playback.json",
                f"{path}.scale",
                "camera_exceeds_headroom",
                f"scale {key['scale']} exceeds {asset_id} headroom {headroom}",
            )

    directed = {moment["id"]: moment for moment in direction.get("moments", [])}
    resolved_ids: set[str] = set()
    for index, cue in enumerate(playback.get("moments", [])):
        path = f"$.moments[{index}]"
        resolved_ids.add(cue["id"])
        moment = directed.get(cue["id"])
        if moment is None:
            issue(
                "playback.json",
                f"{path}.id",
                "moment_not_found",
                f"moment is not directed: {cue['id']}",
            )
            continue
        for field in ("at", "beat", "template"):
            if cue.get(field) != moment.get(field):
                issue(
                    "playback.json",
                    f"{path}.{field}",
                    "moment_mismatch",
                    f"{field} differs from direction: {cue.get(field)} != {moment.get(field)}",
                )
        for param in REQUIRED_MOMENT_PARAMS[cue["template"]]:
            if param not in cue["params"]:
                issue(
                    "playback.json",
                    f"{path}.params",
                    "moment_param_missing",
                    f"{cue['template']} requires params.{param}",
                )
        hold = moment.get("hold_ms")
        if hold is not None and cue["params"].get("hold_ms") != hold:
            issue(
                "playback.json",
                f"{path}.params.hold_ms",
                "moment_mismatch",
                f"hold_ms differs from direction: {hold}",
            )

    for moment_id in sorted(directed.keys() - resolved_ids):
        issue(
            "playback.json",
            "$.moments",
            "moment_unresolved",
            f"directed moment has no cue: {moment_id}",
        )
    return issues


def _chapter_starts(paragraphs: list[JsonObject]) -> list[int]:
    """Map each paragraph position to the position of its chapter heading."""

    chapter = 0
    result = []
    for index, paragraph in enumerate(paragraphs):
        if paragraph["kind"] == "chapter_heading":
            chapter = index
        result.append(chapter)
    return result


def _background_timeline(
    positions: dict[str, int],
    playback: JsonObject,
) -> list[tuple[int, str | None]]:
    timeline = []
    for cue in playback["cues"]:
        position = positions.get(cue["at"])
        if position is None or "background" not in cue:
            continue
        background = cue["background"]
        timeline.append((position, background["asset_id"] if background else None))
    return timeline


def _background_at(timeline: list[tuple[int, str | None]], position: int) -> str | None:
    current = None
    for cue_position, asset_id in timeline:
        if cue_position > position:
            break
        current = asset_id
    return current
