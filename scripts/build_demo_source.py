#!/usr/bin/env python3
"""Build the immutable source manifest for the hand-authored Phase 3 demo."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BOOK_DIR = PROJECT_ROOT / "books" / "restaurant-demo"
SOURCE_PATH = BOOK_DIR / "source.txt"
OUTPUT_PATH = BOOK_DIR / "source.json"


def main() -> None:
    source_bytes = SOURCE_PATH.read_bytes()
    source_text = source_bytes.decode("utf-8")
    blocks = source_text.rstrip("\n").split("\n\n")

    paragraphs = []
    for index, text in enumerate(blocks, start=1):
        if not text:
            raise ValueError(f"empty text block at position {index}")
        kind = "title" if index == 1 else "prose"
        if text.startswith("——"):
            kind = "epigraph"
        paragraphs.append(
            {
                "id": f"p{index:04d}",
                "kind": kind,
                "text": text,
            }
        )

    document = {
        "schema_version": 1,
        "book_id": "restaurant-of-many-orders",
        "revision": 1,
        "title": paragraphs[0]["text"],
        "language": "zh-CN",
        "source": {
            "format": "txt",
            "path": "source.txt",
            "sha256": hashlib.sha256(source_bytes).hexdigest(),
        },
        "paragraphs": paragraphs,
    }

    temporary_path = OUTPUT_PATH.with_suffix(".json.tmp")
    temporary_path.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(OUTPUT_PATH)
    print(f"Wrote {len(paragraphs)} paragraphs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
