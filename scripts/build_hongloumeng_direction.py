#!/usr/bin/env python3
"""Assemble direction.json for books/local/hongloumeng from the scene table.

    uv run --no-project python scripts/build_hongloumeng_direction.py

The scene table in scripts/hongloumeng_scenes.py carries only the director's
judgment (boundaries, locations, moods, music groups). This script turns it
into contract-shaped scenes: ends are derived from the next scene's start,
background/music/ambience tags are expanded from the location and music-group
vocabularies, and coverage is checked against source.json before writing.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hongloumeng_scenes import SCENES

BUNDLE = Path("books/local/hongloumeng")

# Location -> spatial background tags. The playback compiler maps the same
# location ids onto concrete plates, so direction stays free of asset names.
LOCATIONS = {
    "frontmatter": ["front_matter", "paper"],
    "qinggeng": ["mythic_peak", "mist", "jade_stone"],
    "taixu": ["celestial", "cloud_sea", "illusory_realm"],
    "gusu": ["jiangnan", "town", "courtyard"],
    "countryside": ["fields", "village_inn", "open_road"],
    "yangzhou": ["official_study", "lamplight", "books"],
    "journey": ["river", "boat", "distance"],
    "capital": ["capital_street", "archway", "crowds"],
    "rongfu_gate": ["mansion_gate", "stone_lions", "threshold"],
    "ronghall": ["grand_hall", "columns", "plaques"],
    "jiamu": ["matriarch_hall", "warm_lamps", "screens"],
    "neiyuan": ["inner_court", "chambers", "lattice"],
    "lixiang": ["guest_court", "quiet_yard"],
    "ningfu": ["ning_mansion", "cold_hall", "garden_pavilion"],
    "huifang": ["autumn_garden", "pavilion"],
    "qinroom": ["ornate_bedroom", "incense", "canopy"],
    "school": ["clan_school", "desks", "books"],
    "court": ["yamen", "cold_hall", "authority"],
    "rural": ["farmhouse", "village", "hedges"],
    "tiejian": ["mountain_temple", "pines", "incense"],
    "temple": ["city_temple", "incense", "courtyard"],
    "shengqin": ["imperial_visit", "lanterns", "gold_night"],
    "daguan_spring": ["grand_garden", "spring", "willow_peach"],
    "daguan_summer": ["grand_garden", "summer", "lotus_shade"],
    "daguan_autumn": ["grand_garden", "autumn", "reeds_chrysanthemum"],
    "xiaoxiang": ["bamboo_lodge", "lattice_window", "shade"],
    "yihong": ["crabapple_court", "red_candles", "ornate"],
    "hengwu": ["plain_lodge", "strange_rocks", "herbs"],
    "daoxiang": ["thatched_cottage", "vegetable_plots", "rustic"],
    "qiushuang": ["wide_studio", "banana_leaves", "desk"],
    "shuixie": ["water_pavilion", "lotus_pond", "railings"],
    "flowermound": ["petal_brook", "flower_mound", "blossom_drift"],
    "luxue": ["snow_hermitage", "red_plum", "thatch"],
    "longcui": ["nunnery", "plum_snow", "tea_smoke"],
    "moonpav": ["moon_terrace", "still_water", "flute_night"],
    "banquet": ["feast_hall", "lantern_rows", "tables"],
    "raid": ["dark_corridor", "cold_lantern", "shadows"],
    "mourning": ["mourning_hall", "white_drapes", "candles"],
    "decline": ["bare_courtyard", "fallen_leaves", "cold_light"],
    "prison": ["bleak_walls", "confinement"],
    "snowend": ["white_plain", "lone_figure", "vastness"],
    "palace": ["palace_hall", "curtained", "awe"],
    "commonhouse": ["small_house", "plain_rooms", "alley"],
    "study": ["outer_study", "scrolls", "lamplight"],
}

# Music group -> mood tags for direction. Intensity derives from tension.
MUSIC_GROUPS = {
    "taixu": ["ethereal", "dreamlike", "suspended"],
    "chunjiang": ["serene", "flowing", "graceful"],
    "pinghu": ["calm", "moonlit", "spacious"],
    "yuzhou": ["lively", "elegant", "buoyant"],
    "yanle": ["festive", "ceremonial", "bright"],
    "xianting": ["domestic", "even", "unhurried"],
    "meihua": ["noble", "wintry", "pure"],
    "hangong": ["sorrowful", "longing", "inward"],
    "yangguan": ["farewell", "lingering", "distant"],
    "anliu": ["uneasy", "low", "coiled"],
    "bianzheng": ["tense", "striking", "dark"],
    "aiyin": ["mourning", "grave", "hollow"],
    "kongshan": ["empty", "vast", "letting_go"],
}

AMBIENCE_TAGS = {"rain", "bamboo", "crickets", "snowwind", "temple"}
TAG_OK = re.compile(r"^[a-z0-9_]+$")


def main() -> None:
    source = json.loads((BUNDLE / "source.json").read_text(encoding="utf-8"))
    paragraphs = source["paragraphs"]
    order = {p["id"]: i for i, p in enumerate(paragraphs)}
    directable = [p["id"] for p in paragraphs if p["kind"] != "title"]

    errors: list[str] = []
    starts = [row[0] for row in SCENES]
    if starts[0] != directable[0]:
        errors.append(f"first scene must start at {directable[0]}, got {starts[0]}")
    last = -1
    for start in starts:
        if start not in order:
            errors.append(f"unknown paragraph: {start}")
            continue
        if order[start] <= last:
            errors.append(f"scene starts out of order at {start}")
        last = order[start]

    scenes = []
    for index, row in enumerate(SCENES):
        start, label, loc, time, weather, moods, tension, music, amb = row
        if loc not in LOCATIONS:
            errors.append(f"{start}: unknown location {loc!r}")
            continue
        if music is not None and music not in MUSIC_GROUPS:
            errors.append(f"{start}: unknown music group {music!r}")
            continue
        for tag in amb:
            if tag not in AMBIENCE_TAGS:
                errors.append(f"{start}: unknown ambience tag {tag!r}")
        for mood in moods:
            if not TAG_OK.fullmatch(mood):
                errors.append(f"{start}: bad mood tag {mood!r}")

        if index + 1 < len(SCENES):
            end = paragraphs[order[SCENES[index + 1][0]] - 1]["id"]
        else:
            end = paragraphs[-1]["id"]

        scenes.append({
            "id": f"scene_{index + 1:03d}",
            "label": label,
            "start": start,
            "end": end,
            "location": loc,
            "time": time,
            "weather": weather,
            "mood": moods,
            "tension": tension,
            "background": {"tags": LOCATIONS[loc]},
            "music": {
                "tags": MUSIC_GROUPS[music] if music else ["silence"],
                "intensity": round(tension * 0.8, 3) if music else 0.0,
            },
            "ambience": {"tags": list(amb)},
        })

    if errors:
        for error in errors:
            print("ERROR:", error)
        raise SystemExit(1)

    document = {
        "schema_version": 1,
        "book_id": source["book_id"],
        "source_revision": source["revision"],
        "source_sha256": source["source"]["sha256"],
        "scenes": scenes,
    }
    out = BUNDLE / "direction.json"
    out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out}: {len(scenes)} scenes covering {len(directable)} directable paragraphs")


if __name__ == "__main__":
    main()
