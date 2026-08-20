#!/usr/bin/env python3
"""Render the procedural backgrounds for books/death-of-the-living-dead.

The book mixes public-domain paintings with procedurally drawn plates. Both
paths end in the same grade (`finish`) so the whole book reads as one visual
system: low-key, slightly desaturated, cool shadows, amber highlights, canvas
grain and a soft vignette.

    uv run --with pillow --with numpy --no-project \
        python scripts/render_living_dead_backgrounds.py [--paintings DIR]

Painting sources are recorded in the book's assets.json; this script only
crops and grades whatever it finds in --paintings, and draws everything else
from scratch.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1672, 941
SUP = 2  # supersampling factor for the drawn plates


# --------------------------------------------------------------------------
# drawing helpers
# --------------------------------------------------------------------------


class Plate:
    """A supersampled RGB canvas with soft, painterly primitives."""

    def __init__(self, top: tuple, bottom: tuple, seed: int = 0) -> None:
        self.w, self.h = W * SUP, H * SUP
        self.rng = np.random.default_rng(seed)
        ramp = np.linspace(0.0, 1.0, self.h)[:, None]
        top_a = np.array(top, dtype=np.float32)
        bot_a = np.array(bottom, dtype=np.float32)
        grad = top_a[None, None, :] * (1 - ramp[..., None]) + bot_a[None, None, :] * ramp[..., None]
        self.img = np.repeat(grad, self.w, axis=1).astype(np.float32)

    # -- low level -----------------------------------------------------

    def _blend(self, mask: np.ndarray, color: tuple, alpha: float = 1.0) -> None:
        m = (mask * alpha)[..., None]
        c = np.array(color, dtype=np.float32)[None, None, :]
        self.img = self.img * (1 - m) + c * m

    def _shape(self, draw_fn, blur: float = 2.0) -> np.ndarray:
        layer = Image.new("L", (self.w, self.h), 0)
        draw_fn(ImageDraw.Draw(layer))
        if blur:
            layer = layer.filter(ImageFilter.GaussianBlur(blur * SUP))
        return np.asarray(layer, dtype=np.float32) / 255.0

    # -- primitives ----------------------------------------------------

    def glow(self, x: float, y: float, radius: float, color: tuple, strength: float = 1.0) -> None:
        yy, xx = np.mgrid[0 : self.h, 0 : self.w].astype(np.float32)
        d = np.hypot(xx - x * self.w, yy - y * self.h) / (radius * self.w)
        mask = np.clip(1.0 - d, 0.0, 1.0) ** 2.2
        self._blend(mask, color, strength)

    def band(self, y: float, height: float, color: tuple, alpha: float = 0.4) -> None:
        yy = np.linspace(0.0, 1.0, self.h)[:, None]
        mask = np.exp(-(((yy - y) / max(height, 1e-4)) ** 2)) * np.ones((1, self.w), dtype=np.float32)
        self._blend(mask.astype(np.float32), color, alpha)

    def poly(self, points, color: tuple, alpha: float = 1.0, blur: float = 2.0) -> None:
        pts = [(x * self.w, y * self.h) for x, y in points]
        self._blend(self._shape(lambda d: d.polygon(pts, fill=255), blur), color, alpha)

    def rect(self, x0, y0, x1, y1, color, alpha: float = 1.0, blur: float = 2.0) -> None:
        self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], color, alpha, blur)

    def ellipse(self, x0, y0, x1, y1, color, alpha: float = 1.0, blur: float = 2.0) -> None:
        box = [x0 * self.w, y0 * self.h, x1 * self.w, y1 * self.h]
        self._blend(self._shape(lambda d: d.ellipse(box, fill=255), blur), color, alpha)

    def arch(self, x0, x1, y_top, y_base, color, alpha: float = 1.0, blur: float = 2.0) -> None:
        def draw(d: ImageDraw.ImageDraw) -> None:
            left, right = x0 * self.w, x1 * self.w
            t, b = y_top * self.h, y_base * self.h
            span = min((right - left) / 2, max(b - t, 1.0))
            d.rectangle([left, min(t + span, b), right, b], fill=255)
            d.pieslice([left, t, right, t + 2 * span], 180, 360, fill=255)

        self._blend(self._shape(draw, blur), color, alpha)

    def hills(self, y: float, amp: float, color: tuple, seed: int, alpha: float = 1.0) -> None:
        rng = np.random.default_rng(seed)
        phase = rng.uniform(0, math.tau, 4)
        freq = rng.uniform(0.6, 3.0, 4)
        xs = np.linspace(0.0, 1.0, 220)
        ridge = sum(
            math.pow(0.55, i) * np.sin(xs * math.tau * freq[i] + phase[i]) for i in range(4)
        )
        ridge = y - amp * ridge / 2.0
        pts = [*zip(xs, ridge, strict=True), (1.0, 1.05), (0.0, 1.05)]
        self.poly(pts, color, alpha, blur=3.0)

    def trees(self, y: float, count: int, height: float, color: tuple, seed: int,
              bare: bool = False, alpha: float = 1.0) -> None:
        rng = np.random.default_rng(seed)

        def draw(d: ImageDraw.ImageDraw) -> None:
            for i in range(count):
                x = (i + rng.uniform(0.15, 0.85)) / count
                hh = height * rng.uniform(0.7, 1.35)
                trunk = 0.004 * rng.uniform(0.7, 1.6)
                px, py = x * self.w, y * self.h
                d.polygon(
                    [
                        (px - trunk * self.w, py),
                        (px + trunk * self.w, py),
                        (px + trunk * self.w * 0.4, py - hh * self.h),
                        (px - trunk * self.w * 0.4, py - hh * self.h),
                    ],
                    fill=255,
                )
                if bare:
                    for _ in range(7):
                        ang = rng.uniform(-1.25, 1.25)
                        ln = hh * rng.uniform(0.2, 0.5)
                        oy = py - hh * self.h * rng.uniform(0.45, 0.95)
                        d.line(
                            [(px, oy), (px + math.sin(ang) * ln * self.h, oy - math.cos(ang) * ln * self.h)],
                            fill=255,
                            width=max(2, int(3 * SUP * rng.uniform(0.5, 1.4))),
                        )
                else:
                    cw = hh * rng.uniform(0.5, 0.85)
                    d.ellipse(
                        [
                            px - cw * self.h,
                            py - hh * self.h - cw * self.h * 0.55,
                            px + cw * self.h,
                            py - hh * self.h * 0.35 + cw * self.h * 0.55,
                        ],
                        fill=255,
                    )

        self._blend(self._shape(draw, blur=2.2), color, alpha)

    def stones(self, y: float, count: int, color: tuple, seed: int, scale: float = 1.0,
               alpha: float = 1.0) -> None:
        rng = np.random.default_rng(seed)

        def draw(d: ImageDraw.ImageDraw) -> None:
            for i in range(count):
                x = (i + rng.uniform(0.1, 0.9)) / count
                sh = 0.055 * scale * rng.uniform(0.6, 1.5)
                sw = sh * rng.uniform(0.35, 0.6)
                px, py = x * self.w, y * self.h + rng.uniform(-0.02, 0.02) * self.h
                left, right = px - sw * self.h, px + sw * self.h
                t = py - sh * self.h
                kind = rng.integers(0, 3)
                if kind == 0:
                    d.rectangle([left, t, right, py], fill=255)
                elif kind == 1:
                    d.rectangle([left, t + (right - left) / 2, right, py], fill=255)
                    d.pieslice([left, t, right, t + (right - left)], 180, 360, fill=255)
                else:
                    bar = (right - left) * 0.3
                    d.rectangle([px - bar / 2, t, px + bar / 2, py], fill=255)
                    d.rectangle([left, t + (py - t) * 0.22, right, t + (py - t) * 0.38], fill=255)

        self._blend(self._shape(draw, blur=1.6), color, alpha)

    def columns(self, count: int, x0: float, x1: float, y_top: float, y_base: float,
                color: tuple, alpha: float = 1.0) -> None:
        for i in range(count):
            t = i / max(count - 1, 1)
            cx = x0 + (x1 - x0) * t
            w = 0.022 + 0.012 * abs(t - 0.5) * 2
            self.rect(cx - w / 2, y_top, cx + w / 2, y_base, color, alpha, blur=2.0)
            self.rect(cx - w * 0.8, y_top, cx + w * 0.8, y_top + 0.02, color, alpha, blur=2.0)

    def haze(self, color: tuple, alpha: float = 0.1) -> None:
        self._blend(np.ones((self.h, self.w), dtype=np.float32), color, alpha)

    # -- output --------------------------------------------------------

    def _fractal(self, octaves: int = 5, seed: int = 0) -> np.ndarray:
        """Multi-octave value noise at plate resolution, mean 0."""
        rng = np.random.default_rng(seed)
        acc = np.zeros((self.h, self.w), dtype=np.float32)
        amp = 1.0
        for o in range(octaves):
            n = 3 * 2 ** o
            base = rng.random((n, max(2, int(n * self.w / self.h)))).astype(np.float32)
            layer = np.asarray(
                Image.fromarray((base * 255).astype(np.uint8)).resize(
                    (self.w, self.h), Image.BICUBIC
                ),
                dtype=np.float32,
            ) / 255.0
            acc += (layer - 0.5) * amp
            amp *= 0.55
        return acc / 1.9

    def texture(self, strength: float = 0.18, seed: int = 0) -> None:
        """Break up flat fills with painterly value variation."""
        n = self._fractal(5, seed)
        self.img = np.clip(self.img * (1.0 + n[..., None] * strength), 0, 255)

    def warp(self, amount: float = 0.004, seed: int = 0) -> None:
        """Nudge the plate along a noise field so edges stop looking vector-drawn."""
        dx = self._fractal(3, seed + 1) * amount * self.w
        dy = self._fractal(3, seed + 2) * amount * self.h
        yy, xx = np.mgrid[0 : self.h, 0 : self.w].astype(np.float32)
        sx = np.clip(xx + dx, 0, self.w - 1).astype(np.int32)
        sy = np.clip(yy + dy, 0, self.h - 1).astype(np.int32)
        self.img = self.img[sy, sx]

    def to_image(self) -> Image.Image:
        self.warp(0.005, int(self.rng.integers(0, 10000)))
        self.texture(0.20, int(self.rng.integers(0, 10000)))
        arr = np.clip(self.img, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr, "RGB").resize((W, H), Image.LANCZOS)
        bloom = img.filter(ImageFilter.GaussianBlur(14))
        a = np.asarray(img, dtype=np.float32)
        b = np.asarray(bloom, dtype=np.float32)
        return Image.fromarray(np.clip(a + np.clip(b - 118, 0, None) * 0.42, 0, 255).astype(np.uint8), "RGB")


# --------------------------------------------------------------------------
# shared grade
# --------------------------------------------------------------------------


def finish(img: Image.Image, seed: int, warmth: float = 1.0, lift: float = 0.0,
           dim: float = 1.0, soften: float = 0.0) -> Image.Image:
    """Apply the book-wide grade: desaturate, split-tone, vignette, grain."""

    if soften:
        img = img.filter(ImageFilter.GaussianBlur(soften))
    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0

    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    a = a * 0.80 + lum[..., None] * 0.20

    a = np.clip((a - 0.5) * 1.14 + 0.5, 0, 1)
    a = a ** 1.04
    a = a * 0.97 * dim + lift + 0.03 * dim

    shadow = np.array([0.36, 0.44, 0.56], dtype=np.float32)
    light = np.array([1.06, 0.98, 0.84], dtype=np.float32)
    t = np.clip(lum * 1.15, 0, 1)[..., None]
    tone = shadow * (1 - t) + light * t
    a = np.clip(a * (1 - 0.34 * warmth) + a * tone * 0.34 * warmth, 0, 1)

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot((xx / W - 0.5) / 0.62, (yy / H - 0.5) / 0.62)
    a *= np.clip(1.05 - 0.28 * r ** 2.2, 0.45, 1.0)[..., None]

    rng = np.random.default_rng(seed)
    grain = rng.normal(0.0, 0.014, (H, W, 1)).astype(np.float32)
    canvas = rng.normal(0.0, 0.02, (H // 3 + 1, W // 3 + 1, 1)).astype(np.float32)
    canvas = np.asarray(
        Image.fromarray((np.clip(canvas[..., 0] * 4 + 0.5, 0, 1) * 255).astype(np.uint8)).resize(
            (W, H), Image.BILINEAR
        ),
        dtype=np.float32,
    )[..., None] / 255.0
    a = np.clip(a + grain + (canvas - 0.5) * 0.05, 0, 1)

    out = Image.fromarray((a * 255).astype(np.uint8), "RGB")
    return out.filter(ImageFilter.UnsharpMask(radius=2, percent=42, threshold=3))


def crop_painting(path: Path, anchor: float = 0.5, zoom: float = 1.0) -> Image.Image:
    """Crop a painting to the reader aspect around a vertical anchor."""

    src = Image.open(path).convert("RGB")
    sw, sh = src.size
    target = W / H
    cw, ch = sw, sw / target
    if ch > sh:
        ch, cw = sh, sh * target
    cw, ch = cw / zoom, ch / zoom
    left = (sw - cw) / 2
    top = np.clip(anchor * sh - ch / 2, 0, sh - ch)
    box = (int(left), int(top), int(left + cw), int(top + ch))
    return src.crop(box).resize((W, H), Image.LANCZOS)


# --------------------------------------------------------------------------
# procedural plates
# --------------------------------------------------------------------------

def _mood(seed, top, bottom, lights=(), masses=(), fogs=(), floor=None, warp=0.006):
    """A tonal field: broad gradients, a couple of soft light sources, and
    large soft masses standing in for architecture. Deliberately unliteral —
    a reading background should suggest a place, not illustrate it."""
    p = Plate(top, bottom, seed)
    for y, h, color, alpha in fogs:
        p.band(y, h, color, alpha)
    if floor is not None:
        y, color, alpha = floor
        p.rect(-0.05, y, 1.05, 1.05, color, alpha, blur=26)
    for kind, args in masses:
        if kind == "poly":
            pts, color, alpha, blur = args
            p.poly(pts, color, alpha, blur)
        elif kind == "rect":
            x0, y0, x1, y1, color, alpha, blur = args
            p.rect(x0, y0, x1, y1, color, alpha, blur)
        elif kind == "arch":
            x0, x1, yt, yb, color, alpha, blur = args
            p.arch(x0, x1, yt, yb, color, alpha, blur)
        elif kind == "ellipse":
            x0, y0, x1, y1, color, alpha, blur = args
            p.ellipse(x0, y0, x1, y1, color, alpha, blur)
    for x, y, r, color, strength in lights:
        p.glow(x, y, r, color, strength)
    p.warp(warp, seed + 7)
    p.texture(0.26, seed + 9)
    return p.to_image()


def p_slumber_room(seed):
    return _mood(
        seed, (86, 74, 64), (34, 29, 27),
        fogs=[(0.55, 0.22, (120, 96, 70), 0.16)],
        floor=(0.72, (40, 33, 29), 0.85),
        masses=[("rect", (0.00, 0.00, 0.16, 1.00, (28, 23, 21), 0.75, 30)),
                ("rect", (0.86, 0.00, 1.00, 1.00, (28, 23, 21), 0.75, 30)),
                ("poly", ([(0.26, 0.72), (0.74, 0.72), (0.70, 0.62), (0.30, 0.62)],
                          (58, 40, 32), 0.85, 22)),
                ("ellipse", (0.30, 0.50, 0.70, 0.66, (92, 78, 58), 0.28, 34))],
        lights=[(0.22, 0.44, 0.26, (214, 164, 104), 0.50),
                (0.78, 0.44, 0.26, (214, 164, 104), 0.44),
                (0.50, 0.60, 0.34, (160, 124, 86), 0.16)])


def p_casket_showroom(seed):
    return _mood(
        seed, (66, 65, 70), (26, 26, 30),
        fogs=[(0.40, 0.26, (110, 110, 118), 0.14)],
        floor=(0.74, (32, 32, 36), 0.9),
        masses=[("poly", ([(0.06, 0.78), (0.40, 0.72), (0.40, 0.80), (0.06, 0.88)],
                          (48, 44, 44), 0.7, 24)),
                ("poly", ([(0.58, 0.72), (0.94, 0.78), (0.94, 0.88), (0.58, 0.80)],
                          (48, 44, 44), 0.7, 24)),
                ("rect", (0.40, 0.28, 0.60, 0.70, (36, 35, 39), 0.55, 28))],
        lights=[(0.20, 0.10, 0.22, (188, 184, 172), 0.32),
                (0.50, 0.08, 0.22, (188, 184, 172), 0.30),
                (0.80, 0.10, 0.22, (188, 184, 172), 0.32)])


def p_archive_room(seed):
    return _mood(
        seed, (78, 66, 52), (32, 27, 23),
        fogs=[(0.48, 0.24, (128, 102, 66), 0.14)],
        floor=(0.76, (38, 31, 26), 0.9),
        masses=[("rect", (0.00, 0.06, 0.46, 0.78, (40, 32, 26), 0.78, 26)),
                ("rect", (0.00, 0.16, 0.46, 0.22, (64, 52, 40), 0.35, 22)),
                ("rect", (0.00, 0.36, 0.46, 0.42, (64, 52, 40), 0.35, 22)),
                ("rect", (0.00, 0.56, 0.46, 0.62, (64, 52, 40), 0.35, 22)),
                ("poly", ([(0.58, 0.76), (0.98, 0.76), (0.98, 0.84), (0.58, 0.84)],
                          (44, 34, 27), 0.8, 20))],
        lights=[(0.74, 0.58, 0.24, (226, 172, 100), 0.52),
                (0.30, 0.30, 0.40, (150, 118, 76), 0.14)])


def p_dining_hall(seed):
    return _mood(
        seed, (72, 56, 42), (28, 22, 19),
        fogs=[(0.52, 0.20, (150, 108, 60), 0.16)],
        floor=(0.80, (34, 26, 22), 0.9),
        masses=[("rect", (0.08, 0.10, 0.92, 0.44, (58, 44, 33), 0.35, 30)),
                ("poly", ([(0.04, 0.72), (0.96, 0.72), (0.92, 0.66), (0.08, 0.66)],
                          (66, 48, 34), 0.8, 20))],
        lights=[(0.24, 0.58, 0.11, (255, 196, 116), 0.55),
                (0.42, 0.56, 0.10, (255, 196, 116), 0.50),
                (0.60, 0.57, 0.10, (255, 196, 116), 0.50),
                (0.78, 0.58, 0.11, (255, 196, 116), 0.55),
                (0.50, 0.50, 0.42, (170, 118, 62), 0.16)])


def p_golden_chamber(seed):
    return _mood(
        seed, (126, 96, 52), (44, 34, 24),
        fogs=[(0.34, 0.26, (196, 152, 78), 0.20)],
        floor=(0.78, (52, 40, 28), 0.88),
        masses=[("arch", (0.18, 0.82, 0.00, 0.56, (150, 114, 58), 0.30, 34)),
                ("rect", (0.00, 0.00, 0.14, 1.00, (52, 40, 26), 0.66, 30)),
                ("rect", (0.86, 0.00, 1.00, 1.00, (52, 40, 26), 0.66, 30)),
                ("poly", ([(0.30, 0.76), (0.70, 0.76), (0.66, 0.64), (0.34, 0.64)],
                          (96, 66, 40), 0.85, 22))],
        lights=[(0.50, 0.14, 0.34, (255, 212, 138), 0.52),
                (0.50, 0.62, 0.28, (208, 152, 82), 0.20)])


def p_private_room(seed):
    return _mood(
        seed, (62, 60, 68), (26, 26, 31),
        fogs=[(0.34, 0.22, (74, 88, 110), 0.14)],
        floor=(0.82, (30, 29, 33), 0.9),
        masses=[("rect", (0.56, 0.14, 0.92, 0.54, (26, 34, 50), 0.85, 20)),
                ("poly", ([(0.06, 0.82), (0.56, 0.82), (0.56, 0.70), (0.06, 0.70)],
                          (46, 42, 44), 0.75, 22))],
        lights=[(0.74, 0.32, 0.22, (128, 152, 176), 0.34),
                (0.20, 0.58, 0.18, (232, 176, 104), 0.48)])


def p_white_light(seed):
    p = Plate((34, 38, 48), (14, 15, 20), seed)
    for r, a in ((0.90, 0.16), (0.60, 0.22), (0.38, 0.32), (0.20, 0.50), (0.10, 0.90)):
        p.glow(0.5, 0.48, r, (252, 250, 244), a)
    p.band(0.48, 0.30, (210, 216, 224), 0.16)
    p.warp(0.010, seed + 3)
    p.texture(0.16, seed + 5)
    return p.to_image()


def p_cold_tiles(seed):
    return _mood(
        seed, (128, 138, 144), (52, 58, 62),
        fogs=[(0.12, 0.14, (222, 232, 236), 0.30)],
        floor=(0.74, (58, 64, 68), 0.9),
        masses=[("poly", ([(0.20, 0.70), (0.80, 0.70), (0.78, 0.62), (0.22, 0.62)],
                          (140, 150, 156), 0.55, 20)),
                ("rect", (0.00, 0.00, 0.08, 1.00, (44, 50, 54), 0.55, 30)),
                ("rect", (0.92, 0.00, 1.00, 1.00, (44, 50, 54), 0.55, 30))],
        lights=[(0.50, 0.06, 0.46, (206, 224, 230), 0.34),
                (0.50, 0.66, 0.30, (120, 136, 144), 0.14)])


def p_roadside_diner(seed):
    return _mood(
        seed, (26, 34, 54), (44, 40, 42), warp=0.008,
        fogs=[(0.52, 0.10, (120, 96, 70), 0.14)],
        floor=(0.74, (24, 24, 27), 0.9),
        masses=[("rect", (0.26, 0.36, 0.98, 0.70, (32, 29, 30), 0.8, 22)),
                ("rect", (0.04, 0.52, 0.22, 0.74, (28, 26, 28), 0.8, 20))],
        lights=[(0.56, 0.50, 0.26, (222, 168, 96), 0.44),
                (0.44, 0.28, 0.16, (228, 92, 74), 0.36),
                (0.12, 0.56, 0.12, (206, 96, 78), 0.28)])


def p_night_highway(seed):
    return _mood(
        seed, (22, 28, 46), (34, 34, 40), warp=0.009,
        fogs=[(0.54, 0.10, (74, 78, 96), 0.20)],
        floor=(0.60, (26, 26, 30), 0.92),
        masses=[("poly", ([(0.42, 0.56), (0.58, 0.56), (1.15, 1.05), (-0.15, 1.05)],
                          (44, 43, 46), 0.55, 26))],
        lights=[(0.46, 0.55, 0.12, (252, 240, 208), 0.80),
                (0.54, 0.55, 0.12, (252, 240, 208), 0.80),
                (0.50, 0.57, 0.34, (200, 182, 142), 0.24)])


def p_monitor_room(seed):
    return _mood(
        seed, (40, 44, 48), (16, 18, 21),
        floor=(0.80, (20, 21, 24), 0.9),
        masses=[("rect", (0.24, 0.14, 0.76, 0.62, (46, 54, 54), 0.7, 24)),
                ("rect", (0.28, 0.18, 0.72, 0.58, (128, 142, 134), 0.42, 20)),
                ("rect", (0.06, 0.70, 0.94, 0.80, (32, 30, 30), 0.75, 22))],
        lights=[(0.50, 0.38, 0.34, (140, 160, 148), 0.32),
                (0.14, 0.66, 0.14, (226, 176, 106), 0.30)])


def p_dark_void(seed):
    return _mood(
        seed, (34, 34, 42), (12, 12, 16), warp=0.012,
        fogs=[(0.62, 0.24, (18, 18, 24), 0.40)],
        masses=[("poly", ([(0.26, 0.70), (0.66, 0.34), (0.70, 0.40), (0.30, 0.76)],
                          (196, 206, 218), 0.45, 10))],
        lights=[(0.70, 0.36, 0.34, (66, 74, 92), 0.32),
                (0.34, 0.64, 0.16, (150, 162, 180), 0.16)])


def p_police_desk(seed):
    return _mood(
        seed, (58, 58, 60), (24, 24, 27),
        fogs=[(0.36, 0.20, (176, 176, 172), 0.14)],
        floor=(0.78, (28, 28, 31), 0.9),
        masses=[("rect", (0.54, 0.02, 1.00, 0.52, (44, 48, 56), 0.45, 26)),
                ("poly", ([(0.02, 0.80), (0.74, 0.80), (0.72, 0.68), (0.04, 0.68)],
                          (54, 46, 40), 0.8, 22))],
        lights=[(0.26, 0.50, 0.22, (232, 184, 110), 0.52),
                (0.80, 0.22, 0.30, (110, 130, 150), 0.22)])


def p_crematorium(seed):
    return _mood(
        seed, (70, 58, 50), (28, 24, 22),
        fogs=[(0.62, 0.18, (140, 82, 40), 0.16)],
        floor=(0.76, (32, 27, 24), 0.9),
        masses=[("rect", (0.00, 0.00, 1.00, 0.14, (34, 28, 26), 0.7, 30)),
                ("rect", (0.30, 0.22, 0.70, 0.66, (40, 33, 30), 0.75, 22)),
                ("rect", (0.36, 0.30, 0.64, 0.58, (216, 118, 46), 0.55, 24))],
        lights=[(0.50, 0.44, 0.30, (238, 130, 52), 0.55),
                (0.50, 0.44, 0.12, (255, 214, 146), 0.50)])


PROCEDURAL = {
    "slumber-room": (p_slumber_room, 11, 1.0),
    "casket-showroom": (p_casket_showroom, 12, 0.9),
    "archive-room": (p_archive_room, 14, 1.05),
    "dining-hall": (p_dining_hall, 15, 1.1),
    "golden-chamber": (p_golden_chamber, 16, 1.15),
    "private-room": (p_private_room, 18, 0.95),
    "white-light": (p_white_light, 19, 0.6),
    "cold-tiles": (p_cold_tiles, 20, 0.7),
    "roadside-diner": (p_roadside_diner, 21, 1.0),
    "night-highway": (p_night_highway, 22, 0.85),
    "monitor-room": (p_monitor_room, 23, 0.7),
    "dark-void": (p_dark_void, 24, 0.8),
    "police-desk": (p_police_desk, 25, 1.0),
    "crematorium": (p_crematorium, 28, 1.15),
}

# name -> (source stem, vertical anchor, zoom)
PAINTINGS = {
    "cemetery-gate": ("bg_cemetery_gate", 0.62, 1.15),
    "autumn-road": ("bg_autumn_road", 0.52, 1.0),
    "golden-maple": ("bg_golden_maple", 0.50, 1.05),
    "fire-night": ("bg_fire_night", 0.52, 1.0),
    "water-lily": ("bg_water_lily", 0.50, 1.0),
    "house-interior": ("bg_house_interior", 0.55, 1.1),
    "sick-room": ("bg_sick_room", 0.46, 1.1),
    "snow-road": ("bg_snow_road", 0.52, 1.0),
    "chapel-nave": ("bg_chapel_nave", 0.48, 1.05),
    "marble-hall": ("bg_marble_hall", 0.50, 1.0),
    "kitchen": ("bg_kitchen", 0.50, 1.0),
    "garden-cemetery": ("bg_garden_pool", 0.52, 1.14),
    "night-street": ("bg_harbor_moonlight", 0.52, 1.0),
    "widows-walk": ("bg_house_moonlight", 0.52, 1.0),
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--paintings", type=Path, default=None,
                    help="directory holding the downloaded public-domain painting scans")
    ap.add_argument("--out", type=Path,
                    default=Path("books/death-of-the-living-dead/assets/backgrounds"))
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    for name, (fn, seed, warmth) in PROCEDURAL.items():
        finish(fn(seed), seed, warmth).save(
            args.out / f"{name}.jpg", quality=88, subsampling=1, optimize=True, progressive=True
        )
        print("drew", name)

    if args.paintings:
        for i, (name, (stem, anchor, zoom)) in enumerate(PAINTINGS.items()):
            src = args.paintings / f"{stem}.jpg"
            if not src.is_file():
                print("missing painting", stem)
                continue
            finish(crop_painting(src, anchor, zoom), 100 + i, 0.85, dim=0.72, soften=1.4).save(
                args.out / f"{name}.jpg", quality=88, subsampling=1, optimize=True, progressive=True
            )
            print("graded", name)


if __name__ == "__main__":
    main()
