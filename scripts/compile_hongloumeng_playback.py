#!/usr/bin/env python3
"""Catalog assets and compile playback for books/local/hongloumeng.

    uv run --no-project python scripts/compile_hongloumeng_playback.py

Mechanical Director-to-Runtime resolution, mirroring the strategy recorded in
the production protocol: one plate per location (weather can override), one
track per music group held across scenes until the group changes, ambience
only where the scene declares it, clear_text at chapter headings. All
judgment lives in scripts/hongloumeng_scenes.py; this stage only resolves.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from hongloumeng_scenes import SCENES

BUNDLE = Path("books/local/hongloumeng")

# location -> background plate (assets/backgrounds/<plate>.jpg)
PLATE_FOR = {
    "frontmatter": "cover",
    "qinggeng": "qinggeng", "taixu": "taixu", "gusu": "gusu",
    "countryside": "daoxiang", "yangzhou": "study", "journey": "journey",
    "capital": "capital", "rongfu_gate": "capital", "ronghall": "ronghall",
    "jiamu": "jiamu", "neiyuan": "neiyuan", "lixiang": "lixiang",
    "ningfu": "ningfu", "huifang": "daguan_autumn", "qinroom": "qinroom",
    "school": "school", "court": "court", "rural": "daoxiang",
    "tiejian": "tiejian", "temple": "temple", "shengqin": "shengqin",
    "daguan_spring": "daguan_spring", "daguan_summer": "daguan_summer",
    "daguan_autumn": "daguan_autumn", "xiaoxiang": "xiaoxiang",
    "yihong": "yihong", "hengwu": "hengwu", "daoxiang": "daoxiang",
    "qiushuang": "qiushuang", "shuixie": "shuixie",
    "flowermound": "flowermound", "luxue": "luxue", "longcui": "longcui",
    "moonpav": "moonpav", "banquet": "banquet", "raid": "raid",
    "mourning": "mourning", "snowend": "snowend", "palace": "palace",
    "commonhouse": "commonhouse", "study": "study",
}

PLATE_TITLES = {
    "cover": "旧绢封面", "qinggeng": "青埂峰", "taixu": "太虚幻境",
    "gusu": "姑苏水巷", "study": "书斋灯下", "journey": "舟行江上",
    "capital": "神京街市", "ronghall": "荣禧堂", "jiamu": "贾母上房",
    "neiyuan": "内院灯窗", "lixiang": "梨香院", "ningfu": "宁府厅堂",
    "qinroom": "可卿卧房", "school": "家塾", "court": "公堂",
    "daoxiang": "稻香村舍", "tiejian": "铁槛山寺", "temple": "观庙香烟",
    "shengqin": "省亲灯彩", "daguan_spring": "大观园春",
    "daguan_summer": "荷塘夏夜", "daguan_autumn": "大观园秋",
    "xiaoxiang": "潇湘竹影", "yihong": "怡红烛照", "hengwu": "蘅芜素室",
    "qiushuang": "秋爽斋", "shuixie": "藕香水榭", "flowermound": "沁芳花冢",
    "luxue": "芦雪红梅", "longcui": "栊翠庵", "moonpav": "凸碧月夜",
    "banquet": "华筵灯宴", "raid": "夜廊", "mourning": "灵堂素幔",
    "snowend": "白茫茫大地", "palace": "宫闱", "commonhouse": "市井小院",
    "rain_autumn": "秋窗风雨",
}

MUSIC_TITLES = {
    "taixu": ("太虚引", "本书自度曲"),
    "chunjiang": ("春江花月夜（改编）", "传统古曲主题，本仓库合成演奏"),
    "pinghu": ("平湖秋月（改编）", "传统古曲主题，本仓库合成演奏"),
    "yuzhou": ("渔舟唱晚（改编）", "传统古曲主题，本仓库合成演奏"),
    "yanle": ("华筵", "本书自度曲"),
    "xianting": ("闲庭", "本书自度曲"),
    "meihua": ("梅花三弄（改编）", "传统古曲主题，本仓库合成演奏"),
    "hangong": ("汉宫秋月（改编）", "传统古曲主题，本仓库合成演奏"),
    "yangguan": ("阳关三叠（改编）", "传统古曲主题，本仓库合成演奏"),
    "anliu": ("暗流", "本书自度曲"),
    "bianzheng": ("惊变", "本书自度曲"),
    "aiyin": ("挽歌", "本书自度曲"),
    "kongshan": ("空山", "本书自度曲"),
}

MUSIC_TAGS = {
    "taixu": ["ethereal", "dreamlike", "loop"],
    "chunjiang": ["serene", "flowing", "loop"],
    "pinghu": ["calm", "moonlit", "loop"],
    "yuzhou": ["lively", "elegant", "loop"],
    "yanle": ["festive", "ceremonial", "loop"],
    "xianting": ["domestic", "even", "loop"],
    "meihua": ["noble", "wintry", "loop"],
    "hangong": ["sorrowful", "longing", "loop"],
    "yangguan": ["farewell", "lingering", "loop"],
    "anliu": ["uneasy", "low", "loop"],
    "bianzheng": ["tense", "dark", "loop"],
    "aiyin": ["mourning", "grave", "loop"],
    "kongshan": ["empty", "vast", "loop"],
}

AMB_META = {
    "rain": ("秋雨", ["rain", "window", "loop"], 0.3),
    "bamboo": ("竹风", ["wind", "bamboo", "loop"], 0.22),
    "crickets": ("夏夜虫声", ["night", "insects", "loop"], 0.2),
    "snowwind": ("朔风", ["wind", "winter", "loop"], 0.26),
    "temple": ("远寺钟磬", ["bell", "temple", "loop"], 0.2),
}


def plate_for_scene(loc: str, weather: str | None) -> str:
    if loc == "xiaoxiang" and weather == "rain":
        return "rain_autumn"
    return PLATE_FOR[loc]


def build_assets() -> dict:
    assets = []
    bg_dir = BUNDLE / "assets" / "backgrounds"
    for path in sorted(bg_dir.glob("*.jpg")):
        name = path.stem
        assets.append({
            "id": f"bg_{name}",
            "title": PLATE_TITLES.get(name, name),
            "type": "background",
            "path": f"assets/backgrounds/{name}.jpg",
            "tags": [name],
            "license": "Project asset (CC0)",
            "source": "scripts/render_hongloumeng_backgrounds.py",
            "attribution": None,
        })
    for group, (title, provenance) in MUSIC_TITLES.items():
        assets.append({
            "id": f"bgm_{group}",
            "title": title,
            "type": "music",
            "path": f"assets/music/{group}.mp3",
            "tags": MUSIC_TAGS[group],
            "loop": True,
            "license": "Project asset (CC0 synthesis; traditional themes are public domain)",
            "source": f"scripts/synth_hongloumeng_music.py — {provenance}",
            "attribution": None,
        })
    for name, (title, tags, _gain) in AMB_META.items():
        assets.append({
            "id": f"amb_{name}",
            "title": title,
            "type": "ambience",
            "path": f"assets/ambience/{name}.mp3",
            "tags": tags,
            "loop": True,
            "license": "CC0-1.0",
            "source": "scripts/generate_hongloumeng_ambience.sh",
            "attribution": None,
        })
    return {
        "schema_version": 1,
        "catalog_id": "hongloumeng-assets",
        "assets": assets,
    }


def build_playback(source: dict, direction: dict) -> dict:
    kinds = {p["id"]: p["kind"] for p in source["paragraphs"]}
    cues = []
    cur_bg = cur_music = None
    cur_amb: tuple[str, ...] = ()
    for scene, row in zip(direction["scenes"], SCENES, strict=True):
        start, _label, loc, _time, weather, _moods, tension, music, amb = row
        assert scene["start"] == start
        bg = f"bg_{plate_for_scene(loc, weather)}"
        track = f"bgm_{music}" if music else None
        amb_ids = tuple(f"amb_{a}" for a in amb)
        clear = kinds[start] == "chapter_heading"

        cue: dict = {"at": start, "scene_id": scene["id"]}
        changed = False
        if bg != cur_bg:
            cue["background"] = {
                "asset_id": bg, "transition": "crossfade", "duration_ms": 1900,
            }
            cur_bg = bg
            changed = True
        if track != cur_music:
            cue["music"] = (
                {
                    "asset_id": track, "transition": "crossfade",
                    "duration_ms": 3200,
                    "gain": round(0.22 + tension * 0.28, 2),
                }
                if track else None
            )
            cur_music = track
            changed = True
        if amb_ids != cur_amb:
            cue["ambience"] = [
                {"asset_id": a, "gain": AMB_META[a[4:]][2]} for a in amb_ids
            ]
            cur_amb = amb_ids
            changed = True
        if changed or clear:
            cue["clear_text"] = clear
            cues.append(cue)

    # Every chapter heading clears the accumulated text, even when the scene
    # cut sits elsewhere (front-matter sections included): the paragraph
    # stack would otherwise grow across chapters without bound.
    positions = {p["id"]: i for i, p in enumerate(source["paragraphs"])}
    cued = {c["at"] for c in cues}
    ranges = [
        (positions[s["start"]], positions[s["end"]], s["id"])
        for s in direction["scenes"]
    ]
    for pid, kind in kinds.items():
        if kind != "chapter_heading" or pid in cued:
            continue
        at = positions[pid]
        scene_id = next(sid for lo, hi, sid in ranges if lo <= at <= hi)
        cues.append({"at": pid, "scene_id": scene_id, "clear_text": True})
    cues.sort(key=lambda c: positions[c["at"]])
    return {
        "schema_version": 1,
        "book_id": source["book_id"],
        "source_revision": source["revision"],
        "source_sha256": source["source"]["sha256"],
        "asset_catalog_id": "hongloumeng-assets",
        "cues": cues,
    }


def build_guide(source: dict) -> dict:
    refs = []
    for ill in source.get("illustrations", []):
        if ill["source_href"].endswith("00023.jpeg"):
            refs.append({
                "id": "ref_jade",
                "illustration_id": ill["id"],
                "title": "通灵宝玉图式",
                "note": "第八回按图所画通灵宝玉正反面篆文，可随时回看对照。",
            })
        if ill["source_href"].endswith("00024.jpeg"):
            refs.append({
                "id": "ref_locket",
                "illustration_id": ill["id"],
                "title": "金锁图式",
                "note": "第八回按图所画金锁正反面篆文，可随时回看对照。",
            })
    guide = {
        "schema_version": 1,
        "book_id": source["book_id"],
        "source_revision": source["revision"],
        "source_sha256": source["source"]["sha256"],
        "start_at": "p0197",
    }
    if refs:
        guide["references"] = refs
    return guide


def register_library(source: dict) -> None:
    path = Path("books/library.local.json")
    library = json.loads(path.read_text(encoding="utf-8"))
    entry = {
        "book_id": "hongloumeng",
        "path": "local/hongloumeng",
        "title": "红楼梦",
        "author": "曹雪芹",
        "summary": (
            "大观园的四季与一梦：木石前盟与金玉良姻纠缠其间，"
            "贾府自鲜花着锦之盛走向白茫茫大地真干净。"
            "程高一百二十回，人文社红研所校注本。"
        ),
        "cover": "assets/backgrounds/cover.jpg",
        "source_revision": source["revision"],
        "paragraph_count": len(source["paragraphs"]),
        "production": "agent-assisted",
    }
    books = [b for b in library["books"] if b["book_id"] != "hongloumeng"]
    books.append(entry)
    library["books"] = books
    path.write_text(json.dumps(library, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    source = json.loads((BUNDLE / "source.json").read_text(encoding="utf-8"))
    direction = json.loads((BUNDLE / "direction.json").read_text(encoding="utf-8"))

    assets = build_assets()
    (BUNDLE / "assets.json").write_text(
        json.dumps(assets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    playback = build_playback(source, direction)
    (BUNDLE / "playback.json").write_text(
        json.dumps(playback, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    guide = build_guide(source)
    (BUNDLE / "guide.json").write_text(
        json.dumps(guide, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    register_library(source)
    print(f"assets: {len(assets['assets'])}, cues: {len(playback['cues'])}, "
          f"guide refs: {len(guide.get('references', []))}")


if __name__ == "__main__":
    main()
