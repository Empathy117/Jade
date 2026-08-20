#!/usr/bin/env python3
"""Rebuild the demo source through the production TXT importer."""

from __future__ import annotations

from pathlib import Path

from immersive_reader.importing import import_txt


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BOOK_DIR = PROJECT_ROOT / "books" / "restaurant-demo"
SOURCE_PATH = BOOK_DIR / "source.txt"
OUTPUT_PATH = BOOK_DIR / "source.json"


def main() -> None:
    result = import_txt(
        SOURCE_PATH,
        BOOK_DIR,
        book_id="restaurant-of-many-orders",
        revision=1,
        language="zh-CN",
    )
    print(f"Wrote {result.paragraph_count} paragraphs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
