import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
VALID_BUNDLE = ROOT / "tests" / "fixtures" / "valid"


def test_contract_schemas_are_valid_draft_2020_12() -> None:
    for schema_path in sorted(CONTRACTS.glob("*.schema.json")):
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)


def test_valid_fixture_documents_match_their_schemas() -> None:
    document_schemas = {
        "source.json": "source.schema.json",
        "direction.json": "direction.schema.json",
        "assets.json": "assets.schema.json",
        "playback.json": "playback.schema.json",
    }
    for document_name, schema_name in document_schemas.items():
        document = json.loads((VALID_BUNDLE / document_name).read_text(encoding="utf-8"))
        schema = json.loads((CONTRACTS / schema_name).read_text(encoding="utf-8"))
        Draft202012Validator(schema).validate(document)


def _load(name: str) -> dict:
    return json.loads((VALID_BUNDLE / name).read_text(encoding="utf-8"))


def _validator(schema_name: str) -> Draft202012Validator:
    schema = json.loads((CONTRACTS / schema_name).read_text(encoding="utf-8"))
    return Draft202012Validator(schema)


def _direction_v2() -> dict:
    direction = _load("direction.json")
    direction["schema_version"] = 2
    direction["grades"] = {
        "night": {"tint": "#1d2433", "shade": 0.52, "saturation": 0.7},
    }
    scene = direction["scenes"][0]
    scene["grade"] = "night"
    scene["shots"] = [
        {"at": "p0002", "framing": "wide", "move": "drift"},
        {"at": "p0003", "beat": 1, "framing": "close", "move": "push_in", "focus": "trail"},
    ]
    direction["moments"] = [
        {"id": "moment_001", "at": "p0003", "template": "isolate_line", "intent": "threat"},
    ]
    return direction


def _playback_v2() -> dict:
    playback = _load("playback.json")
    playback["schema_version"] = 2
    playback["camera"] = [
        {"at": "p0002", "scale": 1.0, "x": 0, "y": 0, "drift": 0.01},
        {"at": "p0003", "beat": 1, "scale": 1.4, "x": 0.1, "y": -0.05, "blur": 0},
    ]
    playback["moments"] = [
        {
            "id": "moment_001",
            "at": "p0003",
            "template": "isolate_line",
            "params": {
                "dim": 0.72,
                "blur_px": 14,
                "in_ms": 900,
                "out_ms": 1400,
                "hide_chrome": True,
            },
        },
    ]
    playback["cues"][0]["grade"] = {
        "tint": "#1d2433",
        "shade": 0.52,
        "saturation": 0.7,
        "duration_ms": 1600,
    }
    return playback


def test_v2_direction_and_playback_match_their_schemas() -> None:
    _validator("direction.schema.json").validate(_direction_v2())
    _validator("playback.schema.json").validate(_playback_v2())


def test_v1_documents_reject_v2_fields() -> None:
    direction = _direction_v2()
    direction["schema_version"] = 1
    playback = _playback_v2()
    playback["schema_version"] = 1
    assert not _validator("direction.schema.json").is_valid(direction)
    assert not _validator("playback.schema.json").is_valid(playback)

    direction = _load("direction.json")
    direction["scenes"][0]["shots"] = [{"at": "p0002", "framing": "wide", "move": "hold"}]
    assert not _validator("direction.schema.json").is_valid(direction)


def test_grade_shift_moment_requires_a_grade() -> None:
    direction = _direction_v2()
    direction["moments"][0]["template"] = "grade_shift"
    assert not _validator("direction.schema.json").is_valid(direction)
    direction["moments"][0]["grade"] = "night"
    assert _validator("direction.schema.json").is_valid(direction)


def test_moment_hold_is_capped() -> None:
    direction = _direction_v2()
    direction["moments"][0]["hold_ms"] = 2501
    assert not _validator("direction.schema.json").is_valid(direction)


def test_background_assets_accept_framing_metadata() -> None:
    assets = _load("assets.json")
    background = next(a for a in assets["assets"] if a["type"] == "background")
    background["focal_points"] = {"trail": [0.4, 0.5, 0.2, 0.3]}
    background["text_safe_area"] = [0.08, 0.35, 0.84, 0.55]
    background["min_scale_headroom"] = 1.6
    _validator("assets.schema.json").validate(assets)

    music = next(a for a in assets["assets"] if a["type"] == "music")
    music["focal_points"] = {"trail": [0.4, 0.5, 0.2, 0.3]}
    assert not _validator("assets.schema.json").is_valid(assets)


def _direction_visual_novel() -> dict:
    direction = _direction_v2()
    direction["profile"] = "visual_novel"
    scene = direction["scenes"][0]
    scene["layout"] = "adv"
    scene["atmosphere"] = {"particles": "dust", "flicker": "faint"}
    direction["sounds"] = [
        {
            "id": "sound_001",
            "at": "p0003",
            "beat": 1,
            "tags": ["door_slam"],
            "intent": "impact",
        },
    ]
    direction["effects"] = [{"at": "p0003", "type": "shake", "strength": "medium"}]
    direction["cgs"] = [
        {
            "id": "cg_001",
            "at": "p0002",
            "until": "p0003",
            "tags": ["keyhole"],
            "intent": "threat",
        },
    ]
    return direction


def _playback_visual_novel() -> dict:
    playback = _playback_v2()
    cue = playback["cues"][0]
    cue["layout"] = "adv"
    cue["atmosphere"] = {"particles": "dust", "density": 0.4, "flicker": 0.2}
    cue["background"]["transition"] = "iris"
    playback["sounds"] = [
        {"id": "sound_001", "at": "p0003", "beat": 1, "asset_id": "sfx_door", "gain": 0.8},
    ]
    playback["effects"] = [
        {"at": "p0003", "type": "shake", "intensity": 0.5, "duration_ms": 450},
    ]
    playback["cgs"] = [
        {
            "id": "cg_001",
            "at": "p0002",
            "until": "p0003",
            "asset_id": "cg_keyhole",
            "transition": "wipe",
            "duration_ms": 1200,
        },
    ]
    return playback


def test_visual_novel_fields_match_their_schemas() -> None:
    _validator("direction.schema.json").validate(_direction_visual_novel())
    _validator("playback.schema.json").validate(_playback_visual_novel())


def test_v1_documents_reject_visual_novel_fields() -> None:
    direction = _load("direction.json")
    direction["profile"] = "visual_novel"
    assert not _validator("direction.schema.json").is_valid(direction)

    direction = _load("direction.json")
    direction["scenes"][0]["layout"] = "adv"
    assert not _validator("direction.schema.json").is_valid(direction)

    playback = _load("playback.json")
    playback["cues"][0]["layout"] = "adv"
    assert not _validator("playback.schema.json").is_valid(playback)


def test_effect_and_particle_vocabularies_are_closed() -> None:
    direction = _direction_visual_novel()
    direction["effects"][0]["type"] = "explode"
    assert not _validator("direction.schema.json").is_valid(direction)

    direction = _direction_visual_novel()
    direction["scenes"][0]["atmosphere"]["particles"] = "confetti"
    assert not _validator("direction.schema.json").is_valid(direction)


def test_assets_accept_cg_and_sfx() -> None:
    assets = _load("assets.json")
    base = {"tags": ["x"], "license": "CC0-1.0", "source": "test", "attribution": None}
    assets["assets"] += [
        {"id": "cg_keyhole", "type": "cg", "path": "assets/cg/keyhole.jpg", **base},
        {
            "id": "sfx_door",
            "type": "sfx",
            "path": "assets/sfx/door.mp3",
            "duration_ms": 900,
            **base,
        },
    ]
    _validator("assets.schema.json").validate(assets)
    assets["assets"][-1]["loop"] = True
    assert not _validator("assets.schema.json").is_valid(assets)


def _radio_direction() -> dict:
    direction = _direction_visual_novel()
    direction["instruments"] = [
        {
            "id": "instrument_001",
            "kind": "radio",
            "at": "p0002",
            "until": "p0003",
            "intent": "first_contact",
            "states": [
                {"at": "p0002", "state": "listening"},
                {"at": "p0003", "beat": 1, "state": "contact"},
            ],
        }
    ]
    return direction


def _radio_playback() -> dict:
    playback = _playback_visual_novel()
    playback["instruments"] = [
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
                    "frequency": "14.195",
                    "signal": 0.05,
                    "noise": 0.6,
                    "tx": False,
                },
                {
                    "at": "p0003",
                    "beat": 1,
                    "state": "contact",
                    "frequency": "14.255",
                    "signal": 0.6,
                    "noise": 0.3,
                    "tx": False,
                    "tuning": True,
                },
            ],
        }
    ]
    return playback


def test_radio_instrument_matches_its_schemas() -> None:
    _validator("direction.schema.json").validate(_radio_direction())
    _validator("playback.schema.json").validate(_radio_playback())


def test_v1_documents_reject_instruments() -> None:
    direction = _load("direction.json")
    direction["instruments"] = _radio_direction()["instruments"]
    assert not _validator("direction.schema.json").is_valid(direction)


def test_radio_vocabulary_and_frequency_are_closed() -> None:
    direction = _radio_direction()
    direction["instruments"][0]["states"][0]["state"] = "singing"
    assert not _validator("direction.schema.json").is_valid(direction)

    playback = _radio_playback()
    playback["instruments"][0]["keys"][0]["frequency"] = "14.195 MHz"
    assert not _validator("playback.schema.json").is_valid(playback)
