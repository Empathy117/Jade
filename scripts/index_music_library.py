#!/usr/bin/env python3
"""Index the user's private music library for BGM selection.

    just index-music                      # rescan, keep curation, report changes
    just find-music mood=melancholy fit=primary setting=chinese-classical

The library lives outside the repository (OneDrive by default; override with
JADE_MUSIC_LIBRARY or --root). The index is written to
music/library.local.json, which is gitignored like books/local/, and a copy is
mirrored to <root>/jade-music-index.json so the curation travels with the
music. Recordings in the library are personal copies: they may only be used in
books under books/local/, never in a tracked bundle.

A rescan refreshes the technical fields (path, format, duration...) and keeps
every curated field. Entries are matched by path first and then by a
size+duration fingerprint, so moving or renaming a file keeps its curation.
New files arrive with "curation": "pending" and need an agent pass; the
vocabulary is documented in docs/music-library.md.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

DEFAULT_ROOT = Path.home() / "Library/CloudStorage/OneDrive-个人/MusicLibary"
DEFAULT_OUT = Path("music/library.local.json")
MIRROR_NAME = "jade-music-index.json"
AUDIO_EXTS = {".mp3", ".flac", ".m4a", ".mp4", ".aac", ".ogg", ".opus", ".wav"}


VOCAB = {
    "collection": {"classical", "film", "game", "chinese", "pop"},
    "vocals": {"instrumental", "wordless", "choral", "vocal", "dialogue"},
    "fit": {"primary", "accent", "avoid"},
    "moods": {
        "serene", "tender", "romantic", "melancholy", "grief", "nostalgic",
        "wonder", "dreamy", "mysterious", "eerie", "tense", "ominous", "dark",
        "heroic", "epic", "triumphant", "playful", "festive", "whimsical",
        "solemn", "sacred", "lonely", "hopeful", "bittersweet", "pastoral",
        "majestic", "frantic", "contemplative", "elegant", "adventurous",
        "defiant", "warm",
    },
    "settings": {
        "chinese-classical", "wuxia", "japanese", "european-baroque",
        "european-classical", "european-romantic", "viennese", "opera",
        "medieval", "fantasy", "sci-fi", "space", "modern", "urban", "war",
        "crime", "spy", "nature", "sea", "desert", "sacred", "childhood",
        "christmas", "frontier", "latin", "nordic", "slavic", "post-apocalyptic",
        "court", "rural", "dance",
    },
}


def cloud_only(path: Path) -> bool:
    """OneDrive placeholder whose bytes are not on this Mac yet."""
    st = path.stat()
    return st.st_blocks * 512 < st.st_size * 0.9


def probe(path: Path) -> dict | None:
    if cloud_only(path):
        return None  # reading would trigger a slow download; retry next scan
    for _ in range(3):
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", str(path)],
            capture_output=True, text=True, check=False,
        )
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            continue
        if "format" in data:
            return data
    return None


def technical(root: Path, path: Path, data: dict) -> dict:
    fmt = data["format"]
    audio = next(s for s in data["streams"] if s.get("codec_type") == "audio")
    tags = {k.lower(): v for k, v in fmt.get("tags", {}).items()}
    return {
        "path": unicodedata.normalize("NFC", path.relative_to(root).as_posix()),
        "format": path.suffix.lower().lstrip("."),
        "duration_s": round(float(fmt.get("duration", 0)), 1),
        "bitrate_kbps": round(int(fmt.get("bit_rate", 0)) / 1000),
        "sample_rate": int(audio.get("sample_rate", 0)),
        "channels": audio.get("channels"),
        "size": path.stat().st_size,
        "tag_title": tags.get("title"),
        "tag_artist": tags.get("artist"),
        "tag_album": tags.get("album"),
    }


def fingerprint(entry: dict) -> tuple:
    return (entry["size"], round(entry["duration_s"]))


def slug(text: str) -> str:
    """Lowercase, accent-free, hyphenated; CJK and kana are kept as-is."""
    out: list[str] = []
    for c in unicodedata.normalize("NFKD", text):
        if unicodedata.combining(c) and out and out[-1].isascii():
            continue  # drop Latin accents only; kana voicing marks stay
        out.append(c)
    text = unicodedata.normalize("NFC", "".join(out)).lower()
    return re.sub(r"[\W_]+", "-", text).strip("-")[:48].rstrip("-") or "track"


def scan(root: Path, out: Path, mirror: bool) -> int:
    old = json.loads(out.read_text()) if out.exists() else {"tracks": []}
    by_path = {t["path"]: t for t in old["tracks"]}
    by_print = {fingerprint(t): t for t in old["tracks"] if t.get("duration_s")}

    files = sorted(
        p for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS
        and not any(part.startswith(".") for part in p.relative_to(root).parts)
    )
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        probed = list(pool.map(probe, files))

    tracks, used_ids, unreadable, new, offline = [], set(), [], [], []
    matched: set[int] = set()
    for path, data in zip(files, probed, strict=True):
        rel = unicodedata.normalize("NFC", path.relative_to(root).as_posix())
        if data is None and cloud_only(path):
            prior = by_path.get(rel)
            entry = {**prior} if prior else {
                "id": f"{slug(Path(rel).parts[0])}/{slug(path.stem)}",
                "path": rel, "curation": "pending"}
            if prior is not None:
                matched.add(id(prior))
            entry["size"] = path.stat().st_size
            entry.setdefault("duration_s", None)
            entry["probe"] = "cloud-only"
            offline.append(rel)
            while entry["id"] in used_ids:
                entry["id"] += "-2"
            used_ids.add(entry["id"])
            tracks.append(entry)
            continue
        if data is None or not any(
            s.get("codec_type") == "audio" for s in data.get("streams", [])
        ):
            unreadable.append(path.relative_to(root).as_posix())
            continue
        tech = technical(root, path, data)
        prior = by_path.get(tech["path"]) or by_print.get(fingerprint(tech))
        if prior is not None and id(prior) not in matched:
            matched.add(id(prior))
            entry = {**prior, **tech}
            entry.pop("probe", None)
        else:
            base = f"{slug(Path(tech['path']).parts[0])}/{slug(path.stem)}"
            entry = {"id": base, **tech, "curation": "pending"}
            new.append(tech["path"])
        while entry["id"] in used_ids:
            entry["id"] += "-2"
        used_ids.add(entry["id"])
        tracks.append(entry)

    missing = [t["path"] for t in old["tracks"] if id(t) not in matched]
    index = {
        "schema_version": 1,
        "library_root": str(root).replace(str(Path.home()), "~", 1),
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "note": "Personal recordings: usable only in books/local/. "
                "Vocabulary: docs/music-library.md.",
        "tracks": tracks,
    }
    text = json.dumps(index, ensure_ascii=False, indent=1) + "\n"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text)
    if mirror:
        (root / MIRROR_NAME).write_text(text)

    print(f"{len(tracks)} tracks indexed -> {out}")
    for label, items in (("new (curation pending)", new),
                         ("missing since last scan", missing),
                         ("unreadable", unreadable),
                         ("cloud-only, technical fields pending", offline)):
        if items:
            print(f"{label}: {len(items)}")
            for item in items:
                print(f"  {item}")
    return 1 if unreadable else 0


def check(out: Path) -> int:
    tracks = json.loads(out.read_text())["tracks"]
    problems = []
    for t in tracks:
        if t.get("curation") == "pending":
            problems.append(f"{t['id']}: curation pending")
            continue
        for key in ("collection", "vocals", "fit"):
            if t.get(key) not in VOCAB[key]:
                problems.append(f"{t['id']}: bad {key} {t.get(key)!r}")
        for key in ("moods", "settings"):
            for value in t.get(key, []):
                if value not in VOCAB[key]:
                    problems.append(f"{t['id']}: unknown {key[:-1]} {value!r}")
        if t.get("duplicate_of") and t["duplicate_of"] not in {x["id"] for x in tracks}:
            problems.append(f"{t['id']}: duplicate_of points nowhere")
    for p in problems:
        print(p)
    counts = Counter((t.get("collection"), t.get("fit")) for t in tracks)
    for (collection, fit), n in sorted(counts.items(), key=str):
        print(f"{collection or '?':>10} {fit or '?':>8} {n:4}")
    return 1 if problems else 0


def find(out: Path, filters: list[str]) -> int:
    tracks = json.loads(out.read_text())["tracks"]
    keys = {"mood": "moods", "setting": "settings", "instrument": "instruments"}
    for f in filters:
        key, _, value = f.partition("=")
        key = keys.get(key, key)

        def ok(t: dict, key: str = key, value: str = value) -> bool:
            field = t.get(key)
            if isinstance(field, list):
                return value in field
            if key == "energy":
                lo, _, hi = value.partition("-")
                return field is not None and int(lo) <= field <= int(hi or lo)
            return str(field) == value or value.lower() in str(field).lower()

        tracks = [t for t in tracks if ok(t)]
    order = {"primary": 0, "accent": 1, "avoid": 2}
    for t in sorted(tracks, key=lambda t: (order.get(t.get("fit"), 3), t["id"])):
        d = t.get("duration_s") or 0
        minutes = f"{int(d // 60)}:{int(d % 60):02d}" if d else "?"
        print(f"{t.get('fit', '?'):7} {minutes:>6} {t['id']}  "
              f"[{', '.join(t.get('moods', []))}]  {t['path']}")
    print(f"{len(tracks)} match", file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Index the private music library.")
    parser.add_argument("--root", type=Path,
                        default=Path(os.environ.get("JADE_MUSIC_LIBRARY", DEFAULT_ROOT)))
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--no-mirror", action="store_true")
    parser.add_argument("--check", action="store_true",
                        help="validate curation against the vocabulary")
    parser.add_argument("--find", nargs="*", metavar="KEY=VALUE",
                        help="list tracks matching every filter")
    args = parser.parse_args()
    if args.find is not None:
        return find(args.out, args.find)
    if args.check:
        return check(args.out)
    return scan(args.root.expanduser(), args.out, not args.no_mirror)


if __name__ == "__main__":
    sys.exit(main())
