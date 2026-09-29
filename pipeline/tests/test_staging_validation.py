import json
import shutil
from pathlib import Path

from immersive_reader.staging_validation import validate_direction_staging
from immersive_reader.validation import ValidationIssue, validate_bundle

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
VALID_BUNDLE = ROOT / "tests" / "fixtures" / "valid"


def issue_codes(issues: list[ValidationIssue]) -> set[str]:
    return {issue.code for issue in issues}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def staged_bundle(tmp_path: Path) -> Path:
    """The valid fixture, upgraded to a small but complete v2 staging."""

    bundle = tmp_path / "bundle"
    shutil.copytree(VALID_BUNDLE, bundle)

    direction = load_json(bundle / "direction.json")
    direction["schema_version"] = 2
    direction["grades"] = {"night": {"tint": "#1d2433", "shade": 0.52, "saturation": 0.7}}
    scene = direction["scenes"][0]
    scene["grade"] = "night"
    scene["shots"] = [{"at": "p0002", "framing": "medium", "move": "push_in", "focus": "trail"}]
    direction["moments"] = [
        {"id": "moment_001", "at": "p0003", "template": "isolate_line", "intent": "threat"},
    ]
    write_json(bundle / "direction.json", direction)

    assets = load_json(bundle / "assets.json")
    forest = next(asset for asset in assets["assets"] if asset["id"] == "bg_forest_rain")
    forest["focal_points"] = {"trail": [0.4, 0.5, 0.2, 0.3]}
    forest["min_scale_headroom"] = 1.6
    write_json(bundle / "assets.json", assets)

    playback = load_json(bundle / "playback.json")
    playback["schema_version"] = 2
    playback["camera"] = [
        {"at": "p0002", "scale": 1.1, "x": 0, "y": 0},
        {"at": "p0003", "scale": 1.4, "x": 0.1, "y": -0.05},
    ]
    playback["moments"] = [
        {
            "id": "moment_001",
            "at": "p0003",
            "template": "isolate_line",
            "params": {"dim": 0.72, "blur_px": 14},
        }
    ]
    write_json(bundle / "playback.json", playback)
    return bundle


def edit(bundle: Path, name: str, change) -> None:
    document = load_json(bundle / name)
    change(document)
    write_json(bundle / name, document)


def test_staged_bundle_is_valid(tmp_path: Path) -> None:
    assert validate_bundle(staged_bundle(tmp_path), contracts_dir=CONTRACTS) == []


def test_undefined_grade_is_rejected(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)
    edit(bundle, "direction.json", lambda d: d["scenes"][0].update(grade="dawn"))
    assert "grade_not_found" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_shot_outside_scene_is_rejected(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)
    edit(bundle, "direction.json", lambda d: d["scenes"][0]["shots"][0].update(at="p0004"))
    assert "shot_outside_scene" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_shot_budget_is_enforced(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)

    def crowd(direction: dict) -> None:
        direction["scenes"][0]["shots"] = [
            {"at": "p0002", "framing": "wide", "move": "hold"},
            {"at": "p0003", "framing": "wide", "move": "drift"},
        ]

    edit(bundle, "direction.json", crowd)
    assert "shot_budget_exceeded" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_focus_must_exist_on_showing_background(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)
    edit(bundle, "direction.json", lambda d: d["scenes"][0]["shots"][0].update(focus="door"))
    assert "focus_not_found" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_camera_scale_is_bounded_by_headroom(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["camera"][1].update(scale=1.8))
    assert "camera_exceeds_headroom" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )

    # Without recorded headroom a background only allows a gentle push.
    edit(bundle, "playback.json", lambda p: p["camera"][1].update(scale=1.3))
    edit(bundle, "assets.json", lambda a: a["assets"][0].pop("min_scale_headroom"))
    assert "camera_exceeds_headroom" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_camera_keys_must_be_ordered(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["camera"].reverse())
    assert "camera_out_of_order" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_moment_cues_must_match_direction(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["moments"][0].update(at="p0004"))
    assert "moment_mismatch" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))

    edit(bundle, "playback.json", lambda p: p.update(moments=[]))
    assert "moment_unresolved" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_moment_template_params_are_required(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["moments"][0]["params"].pop("dim"))
    assert "moment_param_missing" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_direction_and_playback_versions_must_agree(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)

    def downgrade(playback: dict) -> None:
        playback["schema_version"] = 1
        for field in ("camera", "moments"):
            playback.pop(field)

    edit(bundle, "playback.json", downgrade)
    assert "staging_version_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def long_source(chapters: int, per_chapter: int) -> dict:
    paragraphs = []
    for _chapter in range(chapters):
        paragraphs.append(
            {"id": f"p{len(paragraphs) + 1:04d}", "kind": "chapter_heading", "text": "章"}
        )
        for _ in range(per_chapter):
            paragraphs.append(
                {"id": f"p{len(paragraphs) + 1:04d}", "kind": "prose", "text": "文"}
            )
    return {"paragraphs": paragraphs}


def moment(number: int, at: int, template: str = "isolate_line") -> dict:
    return {
        "id": f"moment_{number:03d}",
        "at": f"p{at:04d}",
        "template": template,
        "intent": "x",
    }


def direction_with(moments: list[dict]) -> dict:
    return {"schema_version": 2, "scenes": [], "moments": moments}


def test_moments_need_breathing_room() -> None:
    source = long_source(1, 100)
    close = direction_with([moment(1, 2), moment(2, 30)])
    far = direction_with([moment(1, 2), moment(2, 42)])
    assert "moments_too_close" in issue_codes(validate_direction_staging(source, close))
    assert validate_direction_staging(source, far) == []


def test_moment_budget_is_per_chapter() -> None:
    source = long_source(2, 150)
    crowded = direction_with([moment(1, 2), moment(2, 50), moment(3, 100)])
    spread = direction_with([moment(1, 2), moment(2, 50), moment(3, 160)])
    assert "moment_budget_exceeded" in issue_codes(validate_direction_staging(source, crowded))
    assert validate_direction_staging(source, spread) == []


def test_flash_cut_is_rare() -> None:
    source = long_source(2, 150)
    flashy = direction_with([moment(1, 2, "flash_cut"), moment(2, 160, "flash_cut")])
    assert "flash_cut_budget_exceeded" in issue_codes(
        validate_direction_staging(source, flashy)
    )


def visual_novel_bundle(tmp_path: Path) -> Path:
    bundle = staged_bundle(tmp_path)
    (bundle / "assets" / "cg").mkdir(parents=True)
    (bundle / "assets" / "sfx").mkdir(parents=True)
    (bundle / "assets" / "cg" / "keyhole.jpg").write_bytes(b"cg")
    (bundle / "assets" / "sfx" / "door.mp3").write_bytes(b"sfx")

    def assets(document: dict) -> None:
        base = {"tags": ["x"], "license": "CC0-1.0", "source": "test", "attribution": None}
        document["assets"] += [
            {"id": "cg_keyhole", "type": "cg", "path": "assets/cg/keyhole.jpg", **base},
            {"id": "sfx_door", "type": "sfx", "path": "assets/sfx/door.mp3", **base},
        ]

    def direction(document: dict) -> None:
        document["profile"] = "visual_novel"
        document["scenes"][0]["layout"] = "adv"
        document["scenes"][0]["atmosphere"] = {"particles": "dust"}
        document["sounds"] = [
            {"id": "sound_001", "at": "p0003", "tags": ["door"], "intent": "impact"},
        ]
        document["effects"] = [{"at": "p0003", "type": "shake", "strength": "medium"}]
        document["cgs"] = [
            {
                "id": "cg_001",
                "at": "p0002",
                "until": "p0003",
                "tags": ["keyhole"],
                "intent": "threat",
            },
        ]

    def playback(document: dict) -> None:
        cue = document["cues"][0]
        cue["layout"] = "adv"
        cue["atmosphere"] = {"particles": "dust", "density": 0.4, "flicker": 0}
        document["sounds"] = [
            {"id": "sound_001", "at": "p0003", "asset_id": "sfx_door", "gain": 0.8}
        ]
        document["effects"] = [{"at": "p0003", "type": "shake", "intensity": 0.5}]
        document["cgs"] = [
            {
                "id": "cg_001",
                "at": "p0002",
                "until": "p0003",
                "asset_id": "cg_keyhole",
                "transition": "iris",
                "duration_ms": 1200,
            }
        ]

    edit(bundle, "assets.json", assets)
    edit(bundle, "direction.json", direction)
    edit(bundle, "playback.json", playback)
    return bundle


def test_visual_novel_bundle_is_valid(tmp_path: Path) -> None:
    assert validate_bundle(visual_novel_bundle(tmp_path), contracts_dir=CONTRACTS) == []


def test_immersive_profile_rejects_visual_novel_features(tmp_path: Path) -> None:
    bundle = visual_novel_bundle(tmp_path)
    edit(bundle, "direction.json", lambda d: d.pop("profile"))
    assert "profile_feature" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_playback_channels_must_mirror_direction(tmp_path: Path) -> None:
    bundle = visual_novel_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["effects"][0].update(type="pulse"))
    edit(bundle, "playback.json", lambda p: p["cgs"][0].update(until="p0004"))
    codes = issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))
    assert {"effects_mismatch", "cgs_mismatch"} <= codes


def test_sound_and_cg_assets_must_have_the_right_type(tmp_path: Path) -> None:
    bundle = visual_novel_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["sounds"][0].update(asset_id="cg_keyhole"))
    assert "asset_type_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_cg_spans_may_not_overlap(tmp_path: Path) -> None:
    bundle = visual_novel_bundle(tmp_path)

    def overlap(direction: dict) -> None:
        direction["cgs"].append(
            {"id": "cg_002", "at": "p0003", "until": "p0004", "tags": ["x"], "intent": "x"}
        )

    edit(bundle, "direction.json", overlap)
    assert "cg_overlap" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_sounds_per_beat_are_capped(tmp_path: Path) -> None:
    bundle = visual_novel_bundle(tmp_path)

    def crowd(direction: dict) -> None:
        for number in (2, 3):
            direction["sounds"].append(
                {"id": f"sound_00{number}", "at": "p0003", "tags": ["x"], "intent": "x"}
            )

    edit(bundle, "direction.json", crowd)
    assert "sound_budget_exceeded" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_visual_novel_budget_allows_denser_moments() -> None:
    source = long_source(1, 100)
    moments = [moment(1, 2), moment(2, 12), moment(3, 22)]
    immersive = direction_with(moments)
    visual_novel = {**direction_with(moments), "profile": "visual_novel"}
    assert "moments_too_close" in issue_codes(validate_direction_staging(source, immersive))
    assert validate_direction_staging(source, visual_novel) == []


def test_immersive_profile_rejects_mask_transitions(tmp_path: Path) -> None:
    bundle = staged_bundle(tmp_path)
    edit(
        bundle, "playback.json", lambda p: p["cues"][0]["background"].update(transition="iris")
    )
    assert "profile_feature" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def radio_bundle(tmp_path: Path) -> Path:
    bundle = visual_novel_bundle(tmp_path)

    def direction(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "radio",
                "at": "p0002",
                "until": "p0003",
                "intent": "first_contact",
                "states": [
                    {"at": "p0002", "state": "listening"},
                    {"at": "p0003", "state": "contact"},
                ],
            }
        ]

    def playback(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "radio",
                "at": "p0002",
                "until": "p0003",
                "placement": "auto",
                "keys": [
                    {
                        "at": "p0002",
                        "state": "listening",
                        "signal": 0.05,
                        "noise": 0.6,
                        "tx": False,
                    },
                    {
                        "at": "p0003",
                        "state": "contact",
                        "frequency": "14.255",
                        "signal": 0.6,
                        "noise": 0.3,
                        "tx": False,
                    },
                ],
            }
        ]

    edit(bundle, "direction.json", direction)
    edit(bundle, "playback.json", playback)
    return bundle


def test_radio_bundle_is_valid(tmp_path: Path) -> None:
    assert validate_bundle(radio_bundle(tmp_path), contracts_dir=CONTRACTS) == []


def test_immersive_profile_rejects_instruments(tmp_path: Path) -> None:
    bundle = radio_bundle(tmp_path)

    def immersive(direction: dict) -> None:
        direction.pop("profile")
        for field in ("sounds", "effects", "cgs"):
            direction.pop(field)
        for scene in direction["scenes"]:
            scene.pop("layout", None)
            scene.pop("atmosphere", None)

    edit(bundle, "direction.json", immersive)
    assert "profile_feature" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_instrument_keys_stay_inside_their_span(tmp_path: Path) -> None:
    bundle = radio_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"][1].update(at="p0004"))
    assert "instrument_outside_span" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_instrument_keys_must_advance(tmp_path: Path) -> None:
    bundle = radio_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"].reverse())
    assert "instrument_out_of_order" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_playback_instruments_mirror_direction(tmp_path: Path) -> None:
    bundle = radio_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0].update(until="p0002"))
    assert "instruments_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )
