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


def _wind_direction() -> dict:
    direction = _direction_visual_novel()
    direction["instruments"] = [
        {
            "id": "instrument_001",
            "kind": "wind",
            "at": "p0002",
            "until": "p0003",
            "intent": "waiting_out_the_gale",
            "states": [
                {"at": "p0002", "state": "calm"},
                {"at": "p0003", "beat": 1, "state": "gale"},
            ],
        }
    ]
    return direction


def _wind_playback() -> dict:
    playback = _playback_visual_novel()
    playback["instruments"] = [
        {
            "id": "instrument_001",
            "kind": "wind",
            "at": "p0002",
            "until": "p0003",
            "placement": "auto",
            "keys": [
                {"at": "p0002", "state": "calm", "strength": 0, "gust": 0},
                {"at": "p0003", "beat": 1, "state": "gale", "from": "sw", "strength": 0.75, "gust": 0.6},
            ],
        }
    ]
    return playback


def test_wind_instrument_matches_its_schemas() -> None:
    _validator("direction.schema.json").validate(_wind_direction())
    _validator("playback.schema.json").validate(_wind_playback())


def test_each_instrument_kind_keeps_its_own_vocabulary() -> None:
    direction = _wind_direction()
    direction["instruments"][0]["states"][0]["state"] = "listening"
    assert not _validator("direction.schema.json").is_valid(direction)

    direction = _radio_direction()
    direction["instruments"][0]["states"][0]["state"] = "gale"
    assert not _validator("direction.schema.json").is_valid(direction)

    playback = _wind_playback()
    playback["instruments"][0]["keys"][1] = _radio_playback()["instruments"][0]["keys"][1]
    assert not _validator("playback.schema.json").is_valid(playback)


def test_wind_direction_is_a_closed_compass_point_and_calm_has_none() -> None:
    playback = _wind_playback()
    playback["instruments"][0]["keys"][1]["from"] = "south-west"
    assert not _validator("playback.schema.json").is_valid(playback)

    playback = _wind_playback()
    playback["instruments"][0]["keys"][0]["from"] = "n"
    assert not _validator("playback.schema.json").is_valid(playback)


def _letter_direction() -> dict:
    direction = _direction_visual_novel()
    direction["instruments"] = [
        {
            "id": "instrument_001",
            "kind": "letter",
            "at": "p0002",
            "until": "p0004",
            "intent": "opening_the_letter",
            "extent": {"at": "p0003", "until": "p0004"},
            "states": [
                {"at": "p0002", "state": "sealed"},
                {"at": "p0003", "state": "reading"},
                {"at": "p0004", "beat": 1, "state": "faltering"},
            ],
        }
    ]
    return direction


def _letter_playback() -> dict:
    playback = _playback_visual_novel()
    playback["instruments"] = [
        {
            "id": "instrument_001",
            "kind": "letter",
            "at": "p0002",
            "until": "p0004",
            "placement": "auto",
            "extent": {"at": "p0003", "until": "p0004"},
            "keys": [
                {"at": "p0002", "state": "sealed"},
                {"at": "p0003", "state": "reading"},
                {"at": "p0004", "beat": 1, "state": "faltering"},
            ],
        }
    ]
    return playback


def test_letter_instrument_matches_its_schemas() -> None:
    _validator("direction.schema.json").validate(_letter_direction())
    _validator("playback.schema.json").validate(_letter_playback())

    direction = _letter_direction()
    del direction["instruments"][0]["extent"]
    _validator("direction.schema.json").validate(direction)


def test_letter_keeps_its_own_vocabulary_and_carries_no_count() -> None:
    direction = _letter_direction()
    direction["instruments"][0]["states"][1]["state"] = "listening"
    assert not _validator("direction.schema.json").is_valid(direction)

    playback = _letter_playback()
    playback["instruments"][0]["keys"][1]["page"] = 3
    assert not _validator("playback.schema.json").is_valid(playback)

    playback = _letter_playback()
    playback["instruments"][0]["keys"][1]["state"] = "torn"
    assert not _validator("playback.schema.json").is_valid(playback)


def test_only_a_letter_has_an_extent() -> None:
    direction = _wind_direction()
    direction["instruments"][0]["extent"] = {"at": "p0002", "until": "p0003"}
    assert not _validator("direction.schema.json").is_valid(direction)

    playback = _radio_playback()
    playback["instruments"][0]["extent"] = {"at": "p0002", "until": "p0003"}
    assert not _validator("playback.schema.json").is_valid(playback)

    playback = _letter_playback()
    playback["instruments"][0]["extent"]["beat"] = 1
    assert not _validator("playback.schema.json").is_valid(playback)


def _pianola_direction() -> dict:
    direction = _direction_visual_novel()
    direction["instruments"] = [
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
    return direction


def _pianola_playback() -> dict:
    playback = _playback_visual_novel()
    playback["instruments"] = [
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
    return playback


def test_pianola_instrument_matches_its_schemas() -> None:
    _validator("direction.schema.json").validate(_pianola_direction())
    _validator("playback.schema.json").validate(_pianola_playback())


def test_pianola_keeps_its_own_vocabulary() -> None:
    direction = _pianola_direction()
    direction["instruments"][0]["states"][1]["state"] = "reading"
    assert not _validator("direction.schema.json").is_valid(direction)

    playback = _pianola_playback()
    playback["instruments"][0]["keys"][1]["notes"] = [1, 5, 8]
    assert not _validator("playback.schema.json").is_valid(playback)


def test_pianola_tempo_is_bounded_and_only_where_the_roll_moves() -> None:
    playback = _pianola_playback()
    playback["instruments"][0]["keys"][1]["tempo"] = 1.4
    assert not _validator("playback.schema.json").is_valid(playback)

    for index in (0, 2):
        playback = _pianola_playback()
        playback["instruments"][0]["keys"][index]["tempo"] = 0.5
        assert not _validator("playback.schema.json").is_valid(playback)


def _incense_direction() -> dict:
    direction = _direction_visual_novel()
    direction["instruments"] = [
        {
            "id": "instrument_001",
            "kind": "incense",
            "at": "p0002",
            "until": "p0004",
            "intent": "the_first_contest",
            "states": [
                {"at": "p0002", "state": "unlit"},
                {"at": "p0003", "state": "burning"},
                {"at": "p0004", "state": "out"},
            ],
        }
    ]
    return direction


def _incense_playback() -> dict:
    playback = _playback_visual_novel()
    playback["instruments"] = [
        {
            "id": "instrument_001",
            "kind": "incense",
            "at": "p0002",
            "until": "p0004",
            "placement": "auto",
            "keys": [
                {"at": "p0002", "state": "unlit", "burnt": 0},
                {"at": "p0003", "state": "burning", "burnt": 0.1},
                {"at": "p0004", "state": "out", "burnt": 1},
            ],
        }
    ]
    return playback


def test_incense_instrument_matches_its_schemas() -> None:
    _validator("direction.schema.json").validate(_incense_direction())
    _validator("playback.schema.json").validate(_incense_playback())


def test_incense_keeps_its_own_vocabulary() -> None:
    direction = _incense_direction()
    direction["instruments"][0]["states"][1]["state"] = "playing"
    assert not _validator("direction.schema.json").is_valid(direction)

    playback = _incense_playback()
    playback["instruments"][0]["keys"][1]["state"] = "smouldering"
    assert not _validator("playback.schema.json").is_valid(playback)


def test_incense_burnt_is_required_bounded_and_zero_while_unlit() -> None:
    playback = _incense_playback()
    del playback["instruments"][0]["keys"][1]["burnt"]
    assert not _validator("playback.schema.json").is_valid(playback)

    playback = _incense_playback()
    playback["instruments"][0]["keys"][2]["burnt"] = 1.2
    assert not _validator("playback.schema.json").is_valid(playback)

    playback = _incense_playback()
    playback["instruments"][0]["keys"][0]["burnt"] = 0.3
    assert not _validator("playback.schema.json").is_valid(playback)


def _gesture_direction() -> dict:
    direction = _direction_visual_novel()
    direction["gestures"] = [
        {"id": "gesture_001", "kind": "grind_ink", "at": "p0002", "intent": "mourning_ink"},
        {"id": "gesture_002", "kind": "press_seal", "at": "p0003", "beat": 1, "intent": "sending_off"},
    ]
    return direction


def _gesture_playback() -> dict:
    playback = _playback_visual_novel()
    playback["gestures"] = [
        {
            "id": "gesture_001",
            "kind": "grind_ink",
            "at": "p0002",
            "placement": "auto",
            "params": {"direction": "ccw", "tone": "pale"},
        },
        {
            "id": "gesture_002",
            "kind": "press_seal",
            "at": "p0003",
            "beat": 1,
            "placement": "center",
            "params": {},
            "sound": {"asset_id": "sfx_seal", "gain": 0.4},
        },
    ]
    return playback


def test_gestures_match_their_schemas() -> None:
    _validator("direction.schema.json").validate(_gesture_direction())
    _validator("playback.schema.json").validate(_gesture_playback())


def test_v1_documents_reject_gestures() -> None:
    direction = _load("direction.json")
    direction["gestures"] = _gesture_direction()["gestures"]
    assert not _validator("direction.schema.json").is_valid(direction)


def test_gesture_kinds_and_params_are_closed() -> None:
    direction = _gesture_direction()
    direction["gestures"][0]["kind"] = "strike_match"
    assert not _validator("direction.schema.json").is_valid(direction)

    playback = _gesture_playback()
    playback["gestures"][0]["params"]["tone"] = "inky"
    assert not _validator("playback.schema.json").is_valid(playback)

    playback = _gesture_playback()
    playback["gestures"][0]["params"]["pressure"] = 0.5
    assert not _validator("playback.schema.json").is_valid(playback)

    playback = _gesture_playback()
    playback["gestures"][1]["params"] = {"direction": "cw"}
    assert not _validator("playback.schema.json").is_valid(playback)
