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


def test_instrument_keys_repeat_the_directed_state(tmp_path: Path) -> None:
    bundle = radio_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"][1].update(state="lost"))
    assert "instrument_state_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def wind_bundle(tmp_path: Path) -> Path:
    bundle = visual_novel_bundle(tmp_path)

    def direction(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "wind",
                "at": "p0002",
                "until": "p0003",
                "intent": "waiting_out_the_gale",
                "states": [
                    {"at": "p0002", "state": "breeze"},
                    {"at": "p0003", "state": "gale"},
                ],
            }
        ]

    def playback(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "wind",
                "at": "p0002",
                "until": "p0003",
                "placement": "auto",
                "keys": [
                    {"at": "p0002", "state": "breeze", "strength": 0.25, "gust": 0.3},
                    {"at": "p0003", "state": "gale", "from": "sw", "strength": 0.75, "gust": 0.6},
                ],
            }
        ]

    edit(bundle, "direction.json", direction)
    edit(bundle, "playback.json", playback)
    return bundle


def test_wind_bundle_is_valid(tmp_path: Path) -> None:
    assert validate_bundle(wind_bundle(tmp_path), contracts_dir=CONTRACTS) == []


def test_wind_keys_repeat_the_directed_state(tmp_path: Path) -> None:
    bundle = wind_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"][0].update(state="gale"))
    assert "instrument_state_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def letter_bundle(tmp_path: Path) -> Path:
    bundle = visual_novel_bundle(tmp_path)
    states = [
        {"at": "p0002", "state": "sealed"},
        {"at": "p0003", "state": "reading"},
        {"at": "p0004", "state": "faltering"},
    ]

    def direction(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "letter",
                "at": "p0002",
                "until": "p0004",
                "intent": "opening_the_letter",
                "extent": {"at": "p0003", "until": "p0004"},
                "states": states,
            }
        ]

    def playback(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "letter",
                "at": "p0002",
                "until": "p0004",
                "placement": "auto",
                "extent": {"at": "p0003", "until": "p0004"},
                "keys": states,
            }
        ]

    edit(bundle, "direction.json", direction)
    edit(bundle, "playback.json", playback)
    return bundle


def edit_letter(bundle: Path, change) -> None:
    """Apply one change to the letter span in both direction and playback."""

    edit(bundle, "direction.json", lambda d: change(d["instruments"][0], "states"))
    edit(bundle, "playback.json", lambda p: change(p["instruments"][0], "keys"))


def test_letter_bundle_is_valid(tmp_path: Path) -> None:
    assert validate_bundle(letter_bundle(tmp_path), contracts_dir=CONTRACTS) == []


def test_letter_keys_repeat_the_directed_state(tmp_path: Path) -> None:
    bundle = letter_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"][2].update(state="reading"))
    assert "instrument_state_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_letter_extent_must_run_forward_and_meet_its_span(tmp_path: Path) -> None:
    inverted = letter_bundle(tmp_path / "inverted")
    edit_letter(inverted, lambda span, _: span.update(extent={"at": "p0004", "until": "p0003"}))
    assert "letter_extent_inverted" in issue_codes(
        validate_bundle(inverted, contracts_dir=CONTRACTS)
    )

    def elsewhere(span: dict, inner: str) -> None:
        span.update(until="p0003", extent={"at": "p0004", "until": "p0004"})
        span[inner].pop()

    apart = letter_bundle(tmp_path / "apart")
    edit_letter(apart, elsewhere)
    assert "letter_extent_outside_span" in issue_codes(
        validate_bundle(apart, contracts_dir=CONTRACTS)
    )

    missing = letter_bundle(tmp_path / "missing")
    edit_letter(missing, lambda span, _: span["extent"].update(until="p0099"))
    assert "paragraph_not_found" in issue_codes(
        validate_bundle(missing, contracts_dir=CONTRACTS)
    )


def test_playback_letter_mirrors_the_extent(tmp_path: Path) -> None:
    bundle = letter_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["extent"].update(at="p0002"))
    assert "instruments_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_an_opened_letter_is_never_sealed_again(tmp_path: Path) -> None:
    bundle = letter_bundle(tmp_path)
    edit_letter(bundle, lambda span, inner: span[inner][2].update(state="sealed"))
    assert "letter_resealed" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_spans_sharing_an_extent_are_one_letter() -> None:
    source = long_source(1, 20)

    def span(number: int, at: int, state: str, extent: bool) -> dict:
        instrument = {
            "id": f"instrument_{number:03d}",
            "kind": "letter",
            "at": f"p{at:04d}",
            "until": f"p{at + 2:04d}",
            "intent": "x",
            "states": [{"at": f"p{at:04d}", "state": state}],
        }
        if extent:
            instrument["extent"] = {"at": "p0002", "until": "p0020"}
        return instrument

    def direction(extent: bool) -> dict:
        return {
            "schema_version": 2,
            "profile": "visual_novel",
            "scenes": [],
            "instruments": [span(1, 4, "reading", extent), span(2, 12, "sealed", extent)],
        }

    assert "letter_resealed" in issue_codes(validate_direction_staging(source, direction(True)))
    # Without a shared extent each span is its own letter.
    assert validate_direction_staging(source, direction(False)) == []


def pianola_bundle(tmp_path: Path) -> Path:
    bundle = visual_novel_bundle(tmp_path)

    def direction(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "pianola",
                "at": "p0002",
                "until": "p0004",
                "intent": "the_house_opens",
                "states": [
                    {"at": "p0002", "state": "closed"},
                    {"at": "p0003", "state": "playing"},
                    {"at": "p0004", "state": "dismantled"},
                ],
            }
        ]

    def playback(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "pianola",
                "at": "p0002",
                "until": "p0004",
                "placement": "auto",
                "keys": [
                    {"at": "p0002", "state": "closed"},
                    {"at": "p0003", "state": "playing", "tempo": 0.7},
                    {"at": "p0004", "state": "dismantled"},
                ],
            }
        ]

    edit(bundle, "direction.json", direction)
    edit(bundle, "playback.json", playback)
    return bundle


def test_pianola_bundle_is_valid(tmp_path: Path) -> None:
    assert validate_bundle(pianola_bundle(tmp_path), contracts_dir=CONTRACTS) == []


def test_pianola_keys_repeat_the_directed_state(tmp_path: Path) -> None:
    bundle = pianola_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"][2].update(state="playing"))
    assert "instrument_state_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_pianola_tempo_is_rejected_on_a_silent_machine(tmp_path: Path) -> None:
    bundle = pianola_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"][2].update(tempo=0.4))
    assert "schema_not" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def incense_bundle(tmp_path: Path) -> Path:
    bundle = visual_novel_bundle(tmp_path)

    def direction(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "incense",
                "at": "p0002",
                "until": "p0004",
                "intent": "the_first_contest",
                "states": [
                    {"at": "p0002", "state": "unlit"},
                    {"at": "p0003", "state": "burning"},
                    {"at": "p0004", "state": "ember"},
                ],
            }
        ]

    def playback(document: dict) -> None:
        document["instruments"] = [
            {
                "id": "instrument_001",
                "kind": "incense",
                "at": "p0002",
                "until": "p0004",
                "placement": "auto",
                "keys": [
                    {"at": "p0002", "state": "unlit", "burnt": 0},
                    {"at": "p0003", "state": "burning", "burnt": 0.1},
                    {"at": "p0004", "state": "ember", "burnt": 0.8},
                ],
            }
        ]

    edit(bundle, "direction.json", direction)
    edit(bundle, "playback.json", playback)
    return bundle


def test_incense_bundle_is_valid(tmp_path: Path) -> None:
    assert validate_bundle(incense_bundle(tmp_path), contracts_dir=CONTRACTS) == []


def test_incense_keys_repeat_the_directed_state(tmp_path: Path) -> None:
    bundle = incense_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"][2].update(state="out"))
    assert "instrument_state_mismatch" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_incense_never_unburns(tmp_path: Path) -> None:
    bundle = incense_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["instruments"][0]["keys"][2].update(burnt=0.05))
    assert "incense_burnt_decreases" in issue_codes(
        validate_bundle(bundle, contracts_dir=CONTRACTS)
    )


def test_incense_states_only_burn_forward(tmp_path: Path) -> None:
    bundle = incense_bundle(tmp_path)

    def relit(document: dict, inner: str) -> None:
        document["instruments"][0][inner][2]["state"] = "unlit"
        if inner == "keys":
            document["instruments"][0][inner][2]["burnt"] = 0

    edit(bundle, "direction.json", lambda d: relit(d, "states"))
    edit(bundle, "playback.json", lambda p: relit(p, "keys"))
    codes = issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))
    assert "incense_state_regressed" in codes
    assert "incense_burnt_decreases" in codes


def test_a_new_span_may_light_a_new_stick() -> None:
    source = long_source(1, 20)

    def span(number: int, at: int, states: list[str]) -> dict:
        return {
            "id": f"instrument_{number:03d}",
            "kind": "incense",
            "at": f"p{at:04d}",
            "until": f"p{at + len(states):04d}",
            "intent": "x",
            "states": [
                {"at": f"p{at + offset:04d}", "state": state}
                for offset, state in enumerate(states)
            ],
        }

    direction = {
        "schema_version": 2,
        "profile": "visual_novel",
        "scenes": [],
        "instruments": [span(1, 2, ["burning", "out"]), span(2, 10, ["unlit", "burning"])],
    }
    assert validate_direction_staging(source, direction) == []


def gesture_bundle(tmp_path: Path) -> Path:
    bundle = visual_novel_bundle(tmp_path)

    def direction(document: dict) -> None:
        document["gestures"] = [
            {"id": "gesture_001", "kind": "press_seal", "at": "p0004", "intent": "sending_off"}
        ]

    def playback(document: dict) -> None:
        document["gestures"] = [
            {
                "id": "gesture_001",
                "kind": "press_seal",
                "at": "p0004",
                "placement": "auto",
                "params": {},
                "sound": {"asset_id": "sfx_door", "gain": 0.4},
            }
        ]

    edit(bundle, "direction.json", direction)
    edit(bundle, "playback.json", playback)
    return bundle


def test_gesture_bundle_is_valid(tmp_path: Path) -> None:
    assert validate_bundle(gesture_bundle(tmp_path), contracts_dir=CONTRACTS) == []


def test_immersive_profile_rejects_gestures(tmp_path: Path) -> None:
    bundle = gesture_bundle(tmp_path)

    def immersive(direction: dict) -> None:
        direction.pop("profile")
        for field in ("sounds", "effects", "cgs"):
            direction.pop(field)
        for scene in direction["scenes"]:
            scene.pop("layout", None)
            scene.pop("atmosphere", None)

    edit(bundle, "direction.json", immersive)
    assert "profile_feature" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_playback_gestures_mirror_direction(tmp_path: Path) -> None:
    bundle = gesture_bundle(tmp_path)
    edit(
        bundle,
        "playback.json",
        lambda p: p["gestures"][0].update(kind="grind_ink", params={"tone": "pale"}),
    )
    assert "gestures_mismatch" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_gesture_sound_must_be_a_sound_effect(tmp_path: Path) -> None:
    bundle = gesture_bundle(tmp_path)
    edit(bundle, "playback.json", lambda p: p["gestures"][0]["sound"].update(asset_id="cg_keyhole"))
    assert "asset_type_mismatch" in issue_codes(validate_bundle(bundle, contracts_dir=CONTRACTS))


def test_gestures_keep_clear_of_moments_and_cgs(tmp_path: Path) -> None:
    def move_to(paragraph: str):
        def change(document: dict) -> None:
            document["gestures"][0]["at"] = paragraph

        return change

    on_moment = gesture_bundle(tmp_path / "moment")
    edit(on_moment, "direction.json", move_to("p0003"))
    edit(on_moment, "playback.json", move_to("p0003"))
    assert "gesture_on_moment" in issue_codes(
        validate_bundle(on_moment, contracts_dir=CONTRACTS)
    )

    under_cg = gesture_bundle(tmp_path / "cg")
    edit(under_cg, "direction.json", move_to("p0002"))
    edit(under_cg, "playback.json", move_to("p0002"))
    assert "gesture_under_cg" in issue_codes(validate_bundle(under_cg, contracts_dir=CONTRACTS))


def test_gestures_are_spaced_like_moments() -> None:
    source = long_source(1, 100)

    def direction(*positions: int) -> dict:
        return {
            "schema_version": 2,
            "profile": "visual_novel",
            "scenes": [],
            "gestures": [
                {"id": f"gesture_{n:03d}", "kind": "grind_ink", "at": f"p{at:04d}", "intent": "x"}
                for n, at in enumerate(positions, start=1)
            ],
        }

    assert "gestures_too_close" in issue_codes(
        validate_direction_staging(source, direction(2, 6))
    )
    assert validate_direction_staging(source, direction(2, 14)) == []
