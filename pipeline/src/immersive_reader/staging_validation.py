"""Cross-document rules for v2 staging: shots, key moments, grades, and camera.

JSON Schema already checks shape and the v1/v2 field gate. The rules here need
more than one document, or encode the presentation budgets of ADR-0004 (the
default immersive profile) and ADR-0005 (the opt-in visual-novel profile).
"""

from __future__ import annotations

from dataclasses import dataclass

from immersive_reader.documents import JsonObject, ValidationIssue


@dataclass(frozen=True)
class Budget:
    moments_per_chapter: int
    paragraphs_between_moments: int
    flash_cuts_per_book: int
    paragraphs_per_shot: int
    sounds_per_beat: int


BUDGETS = {
    "immersive": Budget(2, 40, 1, 3, 0),
    "visual_novel": Budget(6, 8, 3, 2, 2),
}
# Only a visual-novel book may use these; an immersive book stays restrained.
VISUAL_NOVEL_FIELDS = ("sounds", "effects", "cgs")
VISUAL_NOVEL_SCENE_FIELDS = ("layout", "atmosphere")
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
    profile = direction.get("profile", "immersive")
    budget = BUDGETS[profile]

    def issue(path: str, code: str, message: str) -> None:
        issues.append(ValidationIssue("direction.json", path, code, message))

    if profile == "immersive":
        for field in VISUAL_NOVEL_FIELDS:
            if direction.get(field):
                issue(f"$.{field}", "profile_feature", f"{field} needs profile visual_novel")
        for scene_index, scene in enumerate(direction["scenes"]):
            for field in VISUAL_NOVEL_SCENE_FIELDS:
                if field in scene:
                    issue(
                        f"$.scenes[{scene_index}].{field}",
                        "profile_feature",
                        f"{field} needs profile visual_novel",
                    )

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

        allowed = max(1, -(-(end - start + 1) // budget.paragraphs_per_shot))
        if len(shots) > allowed:
            issue(
                f"{scene_path}.shots",
                "shot_budget_exceeded",
                f"{len(shots)} shots over {end - start + 1} paragraphs; "
                f"at most {allowed} allowed",
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
            if flash_cuts > budget.flash_cuts_per_book:
                issue(
                    f"{path}.template",
                    "flash_cut_budget_exceeded",
                    f"at most {budget.flash_cuts_per_book} flash_cut per book",
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
            elif position - previous_key[0] < budget.paragraphs_between_moments:
                issue(
                    f"{path}.at",
                    "moments_too_close",
                    f"{position - previous_key[0]} paragraphs after {previous_id}; "
                    f"at least {budget.paragraphs_between_moments} required",
                )
        previous_moment = (key, moment["id"])

        chapter = chapter_of[position]
        per_chapter[chapter] = per_chapter.get(chapter, 0) + 1
        if per_chapter[chapter] > budget.moments_per_chapter:
            issue(
                f"{path}.at",
                "moment_budget_exceeded",
                f"more than {budget.moments_per_chapter} moments in the chapter "
                f"starting at {paragraphs[chapter]['id']}",
            )
    issues.extend(_validate_visual_novel_direction(positions, direction, budget))
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

    issues.extend(_validate_visual_novel_playback(catalog, direction, playback))
    return issues


def _validate_visual_novel_direction(
    positions: dict[str, int],
    direction: JsonObject,
    budget: Budget,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    def issue(path: str, code: str, message: str) -> None:
        issues.append(ValidationIssue("direction.json", path, code, message))

    def point(entry: JsonObject, path: str) -> Position | None:
        position = positions.get(entry["at"])
        if position is None:
            issue(
                f"{path}.at", "paragraph_not_found", f"paragraph does not exist: {entry['at']}"
            )
            return None
        return (position, entry.get("beat", 0))

    sound_ids: set[str] = set()
    per_beat: dict[Position, int] = {}
    previous: Position | None = None
    for index, sound in enumerate(direction.get("sounds", [])):
        path = f"$.sounds[{index}]"
        if sound["id"] in sound_ids:
            issue(
                f"{path}.id", "duplicate_sound_id", f"sound id is already used: {sound['id']}"
            )
        sound_ids.add(sound["id"])
        key = point(sound, path)
        if key is None:
            continue
        if previous is not None and key < previous:
            issue(
                f"{path}.at",
                "sound_out_of_order",
                f"sound is before the previous one: {sound['at']}",
            )
        previous = key
        per_beat[key] = per_beat.get(key, 0) + 1
        if per_beat[key] > budget.sounds_per_beat:
            issue(
                f"{path}.at",
                "sound_budget_exceeded",
                f"more than {budget.sounds_per_beat} sounds on one reading beat",
            )

    seen_effects: set[tuple[Position, str]] = set()
    for index, effect in enumerate(direction.get("effects", [])):
        path = f"$.effects[{index}]"
        key = point(effect, path)
        if key is None:
            continue
        if (key, effect["type"]) in seen_effects:
            issue(
                f"{path}.type",
                "duplicate_effect",
                f"{effect['type']} repeats on one reading beat",
            )
        seen_effects.add((key, effect["type"]))

    cg_ids: set[str] = set()
    previous_end: Position | None = None
    for index, cg in enumerate(direction.get("cgs", [])):
        path = f"$.cgs[{index}]"
        if cg["id"] in cg_ids:
            issue(f"{path}.id", "duplicate_cg_id", f"cg id is already used: {cg['id']}")
        cg_ids.add(cg["id"])
        start = point(cg, path)
        until = positions.get(cg["until"])
        if until is None:
            issue(
                f"{path}.until",
                "paragraph_not_found",
                f"paragraph does not exist: {cg['until']}",
            )
        if start is None or until is None:
            continue
        end = (until, cg.get("until_beat", 0))
        if end < start:
            issue(f"{path}.until", "cg_inverted", f"cg ends before it starts: {cg['id']}")
        if previous_end is not None and start <= previous_end:
            issue(f"{path}.at", "cg_overlap", f"cg overlaps the previous one: {cg['id']}")
        previous_end = max(previous_end or end, end)
    return issues


def _validate_visual_novel_playback(
    catalog: dict[str, JsonObject],
    direction: JsonObject,
    playback: JsonObject,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    def issue(path: str, code: str, message: str) -> None:
        issues.append(ValidationIssue("playback.json", path, code, message))

    if direction.get("profile", "immersive") == "immersive":
        for field in VISUAL_NOVEL_FIELDS:
            if playback.get(field):
                issue(f"$.{field}", "profile_feature", f"{field} needs profile visual_novel")
        for index, cue in enumerate(playback["cues"]):
            for field in VISUAL_NOVEL_SCENE_FIELDS:
                if field in cue:
                    issue(
                        f"$.cues[{index}].{field}",
                        "profile_feature",
                        f"{field} needs profile visual_novel",
                    )

    def check_asset(asset_id: str, expected: str, path: str) -> None:
        actual = catalog.get(asset_id, {}).get("type")
        if actual is None:
            issue(path, "asset_not_found", f"asset does not exist: {asset_id}")
        elif actual != expected:
            issue(path, "asset_type_mismatch", f"expected {expected}, got {actual}: {asset_id}")

    def mirror(field: str, keys: tuple[str, ...]) -> None:
        directed = [tuple(entry.get(key) for key in keys) for entry in direction.get(field, [])]
        resolved = [tuple(entry.get(key) for key in keys) for entry in playback.get(field, [])]
        if sorted(directed, key=repr) != sorted(resolved, key=repr):
            issue(
                f"$.{field}", f"{field}_mismatch", f"playback {field} do not mirror direction"
            )

    mirror("sounds", ("id", "at", "beat"))
    mirror("effects", ("at", "beat", "type"))
    mirror("cgs", ("id", "at", "beat", "until", "until_beat"))

    for index, sound in enumerate(playback.get("sounds", [])):
        check_asset(sound["asset_id"], "sfx", f"$.sounds[{index}].asset_id")
    for index, cg in enumerate(playback.get("cgs", [])):
        check_asset(cg["asset_id"], "cg", f"$.cgs[{index}].asset_id")
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
