#!/usr/bin/env python3
"""Render placeholder event art (CG) for the 钥匙孔 slice of 要求特别多的餐厅.

These are procedural stand-ins so the visual-novel slice can be staged and
timed; the commissioned versions are described by prompts in the book's
production notes and replace these files under the same names.

    uv run --with pillow --with numpy --no-project \
        python scripts/render_restaurant_cgs.py

- keyhole-eyes.jpg: the final door up close — two keyholes under engraved
  silver cutlery, a pair of blue eyes looking out.
- crumpled-paper.jpg: a sheet of tissue paper crushed in a fist, lit from the
  door gap — the text's own image for the gentlemen's faces, without drawing
  a face.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1920, 1080
OUT = Path(__file__).resolve().parents[1] / "books" / "restaurant-demo" / "assets" / "cg"
RNG = np.random.default_rng(1921)


def smooth_noise(width: int, height: int, scale: int) -> np.ndarray:
    small = RNG.random((max(2, height // scale), max(2, width // scale)))
    image = Image.fromarray((small * 255).astype(np.uint8)).resize(
        (width, height), Image.BICUBIC
    )
    return np.asarray(image, dtype=np.float32) / 255


def finish(rgb: np.ndarray, vignette: float, grain: float) -> Image.Image:
    yy, xx = np.mgrid[0:H, 0:W]
    distance = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    rgb = rgb * (1 - vignette * np.clip(distance - 0.35, 0, 1)[..., None] ** 1.4)
    rgb = rgb + (RNG.standard_normal((H, W, 1)) * grain)
    return Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8))


def keyhole_eyes() -> Image.Image:
    # Dark lacquered wood: long vertical grain over slow tonal drift.
    streaks = (
        np.asarray(
            Image.fromarray((RNG.random((H // 60, W)) * 255).astype(np.uint8)).resize(
                (W, H), Image.BICUBIC
            ),
            dtype=np.float32,
        )
        / 255
    )
    tone = 0.55 * streaks + 0.45 * smooth_noise(W, H, 180)
    wood = np.stack([0.16 + 0.10 * tone, 0.10 + 0.06 * tone, 0.07 + 0.04 * tone], axis=-1)

    # A warm sconce off to the left.
    yy, xx = np.mgrid[0:H, 0:W]
    light = np.exp(-(((xx + 200) / (W * 0.75)) ** 2 + ((yy - H * 0.35) / (H * 0.9)) ** 2))
    wood = wood * (0.55 + 0.9 * light[..., None])

    canvas = Image.fromarray(np.clip(wood * 255, 0, 255).astype(np.uint8))
    glow = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(canvas)
    glow_draw = ImageDraw.Draw(glow)

    silver = (178, 182, 188)
    shadow = (40, 32, 28)
    for cx, tool in ((int(W * 0.36), "fork"), (int(W * 0.64), "knife")):
        cy = int(H * 0.56)
        # Brass escutcheon plate.
        draw.rounded_rectangle(
            (cx - 92, cy - 150, cx + 92, cy + 170),
            46,
            fill=(62, 50, 34),
            outline=(120, 98, 62),
            width=4,
        )
        # Engraved cutlery above the keyhole.
        top = cy - 390
        if tool == "fork":
            draw.rectangle((cx - 9 + 3, top + 110 + 3, cx + 9 + 3, top + 230 + 3), fill=shadow)
            draw.rectangle((cx - 9, top + 110, cx + 9, top + 230), fill=silver)
            draw.rounded_rectangle((cx - 34, top + 70, cx + 34, top + 122), 16, fill=silver)
            for offset in (-30, -10, 10, 30):
                draw.rectangle((cx + offset - 4, top, cx + offset + 4, top + 90), fill=silver)
        else:
            draw.rectangle((cx - 9 + 3, top + 130 + 3, cx + 9 + 3, top + 230 + 3), fill=shadow)
            draw.rectangle((cx - 9, top + 130, cx + 9, top + 230), fill=silver)
            draw.polygon(
                [
                    (cx - 16, top + 135),
                    (cx - 16, top + 10),
                    (cx + 4, top),
                    (cx + 22, top + 60),
                    (cx + 16, top + 135),
                ],
                fill=silver,
            )
        # The keyhole: a round bow over a flared slot, black inside.
        draw.ellipse((cx - 44, cy - 96, cx + 44, cy - 8), fill=(4, 4, 5))
        draw.polygon(
            [(cx - 22, cy - 30), (cx + 22, cy - 30), (cx + 38, cy + 120), (cx - 38, cy + 120)],
            fill=(4, 4, 5),
        )
        # An eye in the bow, glancing aside.
        ex, ey = cx - 8, cy - 52
        for radius, colour in ((30, (20, 70, 96)), (24, (46, 132, 170)), (15, (92, 186, 214))):
            draw.ellipse((ex - radius, ey - radius, ex + radius, ey + radius), fill=colour)
        draw.ellipse((ex - 9, ey - 10, ex + 9, ey + 10), fill=(3, 6, 8))
        draw.ellipse((ex + 6, ey - 16, ex + 13, ey - 9), fill=(236, 248, 255))
        glow_draw.ellipse((ex - 46, ey - 46, ex + 46, ey + 46), fill=(40, 150, 200))

    glow = glow.filter(ImageFilter.GaussianBlur(38))
    rgb = (
        np.asarray(canvas, dtype=np.float32) / 255
        + 0.55 * np.asarray(glow, dtype=np.float32) / 255
    )
    return finish(rgb, vignette=0.95, grain=0.018)


def crumpled_paper() -> Image.Image:
    # Crushed and half-smoothed paper is planes meeting at straight creases.
    # Summing tent functions across random lines builds exactly that; local
    # creases (tents faded by a window) add the fine crumpling.
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    height = np.zeros((H, W), dtype=np.float32)
    for index in range(150):
        local = index >= 30
        angle = RNG.uniform(0, np.pi)
        nx, ny = np.cos(angle), np.sin(angle)
        px, py = RNG.uniform(-0.1, 1.1) * W, RNG.uniform(-0.1, 1.1) * H
        distance = (xx - px) * nx + (yy - py) * ny
        tent = np.abs(distance) * RNG.choice([-1, 1]) * RNG.uniform(0.02, 0.07)
        if local:
            along = (xx - px) * -ny + (yy - py) * nx
            reach = RNG.uniform(90, 320)
            tent = (
                tent * np.exp(-((along / reach) ** 2) - (distance / (reach * 0.9)) ** 2) * 2.2
            )
        height += tent
    gy, gx = np.gradient(height)
    normal = np.stack([-gx, -gy, np.ones_like(height)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    light = np.array([-0.62, -0.42, 0.66])
    light /= np.linalg.norm(light)
    lit = np.clip(normal @ light, 0, 1)
    tone = 0.08 + 0.9 * lit**2.2
    # Pale paper under cold light from the door gap.
    rgb = np.stack([tone * 0.86, tone * 0.9, tone * 0.96], axis=-1)
    return finish(rgb, vignette=1.1, grain=0.02)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    keyhole_eyes().save(OUT / "keyhole-eyes.jpg", quality=90)
    crumpled_paper().save(OUT / "crumpled-paper.jpg", quality=90)
    print(f"Rendered placeholder CGs in {OUT}")


if __name__ == "__main__":
    main()
