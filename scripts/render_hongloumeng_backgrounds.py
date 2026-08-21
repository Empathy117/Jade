#!/usr/bin/env python3
"""Render the procedural backgrounds for books/local/hongloumeng.

The whole book reads as one visual system: deep aged-silk ground, ink washes
in indigo and pine, azurite/malachite (石青/石绿) accents, muted gold and
rouge, a shared silk-weave grain and vignette. Plates are tonal fields that
suggest a place rather than illustrate it — the reading text always sits on
top, so values stay low and compositions stay calm.

    uv run --with pillow --with numpy --no-project \
        python scripts/render_hongloumeng_backgrounds.py
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1672, 941
SUP = 2

# ---- shared palette: aged silk, ink, mineral pigments -----------------------
SILK_HI = (46, 40, 32)
SILK_LO = (20, 17, 14)
INK_DAI = (52, 64, 70)       # 黛青
INK_PINE = (44, 60, 52)      # 松绿
AZURITE = (66, 100, 122)     # 石青
MALACHITE = (74, 116, 92)    # 石绿
MOON = (214, 216, 202)       # 月白
GOLD = (186, 152, 92)        # 泥金
ROUGE = (158, 66, 66)        # 胭脂
PAPER = (196, 182, 150)      # 绢面亮部


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

    def glow(self, x, y, radius, color, strength=1.0, aspect=1.0) -> None:
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        d = np.hypot((xx - x * self.w) / aspect, yy - y * self.h) / (radius * self.w)
        mask = np.clip(1.0 - d, 0.0, 1.0) ** 2.2
        self._blend(mask, color, strength)

    def band(self, y, height, color, alpha=0.4) -> None:
        yy = np.linspace(0.0, 1.0, self.h)[:, None]
        mask = np.exp(-(((yy - y) / max(height, 1e-4)) ** 2)) * np.ones((1, self.w), np.float32)
        self._blend(mask.astype(np.float32), color, alpha)

    def poly(self, points, color, alpha=1.0, blur=2.0) -> None:
        pts = [(x * self.w, y * self.h) for x, y in points]
        self._blend(self._shape(lambda d: d.polygon(pts, fill=255), blur), color, alpha)

    def rect(self, x0, y0, x1, y1, color, alpha=1.0, blur=2.0) -> None:
        self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], color, alpha, blur)

    def ellipse(self, x0, y0, x1, y1, color, alpha=1.0, blur=2.0) -> None:
        box = [x0 * self.w, y0 * self.h, x1 * self.w, y1 * self.h]
        self._blend(self._shape(lambda d: d.ellipse(box, fill=255), blur), color, alpha)

    def line(self, x0, y0, x1, y1, color, width=0.002, alpha=1.0, blur=1.6) -> None:
        def draw(d):
            d.line([(x0 * self.w, y0 * self.h), (x1 * self.w, y1 * self.h)],
                   fill=255, width=max(1, int(width * self.w)))
        self._blend(self._shape(draw, blur), color, alpha)

    def ridge(self, y, amp, color, seed, alpha=1.0, blur=3.0, jag=4) -> None:
        rng = np.random.default_rng(seed)
        phase = rng.uniform(0, math.tau, jag)
        freq = rng.uniform(0.6, 3.2, jag)
        xs = np.linspace(0.0, 1.0, 240)
        r = sum(math.pow(0.55, i) * np.sin(xs * math.tau * freq[i] + phase[i]) for i in range(jag))
        pts = [*zip(xs, y - amp * r / 2.0, strict=True), (1.0, 1.05), (0.0, 1.05)]
        self.poly(pts, color, alpha, blur=blur)

    def peaks(self, y, amp, color, seed, alpha=1.0) -> None:
        rng = np.random.default_rng(seed)

        def draw(d):
            x = -0.05
            while x < 1.05:
                w_ = rng.uniform(0.08, 0.22)
                h_ = amp * rng.uniform(0.55, 1.3)
                cx = x + w_ / 2
                d.polygon([
                    (x * self.w, y * self.h),
                    (cx * self.w, (y - h_) * self.h),
                    ((cx + rng.uniform(0.01, 0.05)) * self.w, (y - h_ * rng.uniform(0.55, 0.8)) * self.h),
                    ((x + w_) * self.w, y * self.h),
                ], fill=255)
                x += w_ * rng.uniform(0.55, 0.8)
            d.rectangle([0, y * self.h, self.w, self.h], fill=255)

        self._blend(self._shape(draw, blur=2.6), color, alpha)

    def mist(self, y, height, color=MOON, alpha=0.12, seed=0) -> None:
        n = self._fractal(4, seed)
        yy = np.linspace(0.0, 1.0, self.h)[:, None]
        envelope = np.exp(-(((yy - y) / max(height, 1e-4)) ** 2))
        mask = np.clip(envelope * (0.6 + n * 1.2), 0, 1).astype(np.float32)
        self._blend(mask, color, alpha)

    def bamboo(self, x, y_top, y_base, lean, color, seed, alpha=0.8, width=0.004) -> None:
        rng = np.random.default_rng(seed)

        def draw(d):
            segments = 6
            px, py = x, y_base
            for s in range(segments):
                ny = y_base + (y_top - y_base) * (s + 1) / segments
                nx = x + lean * ((s + 1) / segments) ** 1.4
                d.line([(px * self.w, py * self.h), (nx * self.w, ny * self.h)],
                       fill=255, width=max(2, int(width * self.w * (1 - 0.4 * s / segments))))
                px, py = nx, ny
            for _ in range(rng.integers(5, 9)):
                t = rng.uniform(0.35, 1.0)
                bx = x + lean * t ** 1.4
                by = y_base + (y_top - y_base) * t
                ang = rng.uniform(-0.9, 0.9) + (0.6 if rng.random() > 0.5 else -0.6)
                ln = rng.uniform(0.03, 0.075)
                for _ in range(3):
                    la = ang + rng.uniform(-0.5, 0.5)
                    d.line([(bx * self.w, by * self.h),
                            ((bx + math.sin(la) * ln) * self.w, (by + math.cos(la) * ln * 0.6) * self.h)],
                           fill=255, width=max(2, int(0.0035 * self.w)))

        self._blend(self._shape(draw, blur=1.8), color, alpha)

    def blossoms(self, count, color, seed, y_range=(0.0, 1.0), size=0.006, alpha=0.7) -> None:
        rng = np.random.default_rng(seed)

        def draw(d):
            for _ in range(count):
                x = rng.uniform(-0.02, 1.02)
                y = rng.uniform(*y_range)
                r = size * rng.uniform(0.4, 1.4) * self.w
                d.ellipse([x * self.w - r, y * self.h - r * 0.8, x * self.w + r, y * self.h + r * 0.8], fill=255)

        self._blend(self._shape(draw, blur=1.4), color, alpha)

    def branch(self, x0, y0, x1, y1, color, seed, alpha=0.9, twigs=6) -> None:
        rng = np.random.default_rng(seed)

        def draw(d):
            d.line([(x0 * self.w, y0 * self.h), (x1 * self.w, y1 * self.h)],
                   fill=255, width=max(3, int(0.005 * self.w)))
            for _ in range(twigs):
                t = rng.uniform(0.2, 0.95)
                bx, by = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                ang = math.atan2(y1 - y0, x1 - x0) + rng.uniform(-1.1, 1.1)
                ln = rng.uniform(0.04, 0.12)
                d.line([(bx * self.w, by * self.h),
                        ((bx + math.cos(ang) * ln) * self.w, (by + math.sin(ang) * ln) * self.h)],
                       fill=255, width=max(2, int(0.0028 * self.w)))

        self._blend(self._shape(draw, blur=1.6), color, alpha)

    def lattice(self, x0, y0, x1, y1, color, glow_color, seed=0, cells=(6, 4), alpha=0.5) -> None:
        self.rect(x0, y0, x1, y1, glow_color, alpha * 0.85, blur=10)

        def draw(d):
            for i in range(cells[0] + 1):
                x = x0 + (x1 - x0) * i / cells[0]
                d.line([(x * self.w, y0 * self.h), (x * self.w, y1 * self.h)],
                       fill=255, width=max(2, int(0.0035 * self.w)))
            for j in range(cells[1] + 1):
                y = y0 + (y1 - y0) * j / cells[1]
                d.line([(x0 * self.w, y * self.h), (x1 * self.w, y * self.h)],
                       fill=255, width=max(2, int(0.0035 * self.w)))

        self._blend(self._shape(draw, blur=1.2), color, alpha)

    def roofline(self, y, x0, x1, rise, color, alpha=0.9, blur=2.2) -> None:
        xs = np.linspace(x0, x1, 60)
        curve = y - rise * np.sin(np.linspace(0, math.pi, 60)) ** 0.6
        pts = [*zip(xs, curve, strict=True), (x1, y + 0.02), (x0, y + 0.02)]
        self.poly(pts, color, alpha, blur)
        tip = 0.015
        self.poly([(x0 - tip, y - rise * 0.75), (x0 + tip, y - rise * 0.2), (x0 + tip * 2, y)],
                  color, alpha, blur)
        self.poly([(x1 + tip, y - rise * 0.75), (x1 - tip, y - rise * 0.2), (x1 - tip * 2, y)],
                  color, alpha, blur)

    def columns(self, count, x0, x1, y_top, y_base, color, alpha=1.0) -> None:
        for i in range(count):
            t = i / max(count - 1, 1)
            cx = x0 + (x1 - x0) * t
            w_ = 0.02 + 0.012 * abs(t - 0.5) * 2
            self.rect(cx - w_ / 2, y_top, cx + w_ / 2, y_base, color, alpha, blur=2.0)

    def lantern_row(self, y, count, color, seed, x0=0.08, x1=0.92, r=0.018, strength=0.5) -> None:
        rng = np.random.default_rng(seed)
        for i in range(count):
            x = x0 + (x1 - x0) * i / max(count - 1, 1) + rng.uniform(-0.015, 0.015)
            self.glow(x, y + rng.uniform(-0.012, 0.012), r * rng.uniform(0.8, 1.25), color, strength)

    def water(self, y, color=AZURITE, alpha=0.2, seed=0) -> None:
        n = self._fractal(4, seed)
        yy = np.linspace(0.0, 1.0, self.h)[:, None]
        env = np.clip((yy - y) / max(1.0 - y, 1e-4), 0, 1) ** 0.7
        streak = np.abs(np.sin(yy * 260 + n * 8)) ** 6
        mask = (env * (0.25 + 0.75 * streak) * (0.6 + n)).astype(np.float32)
        self._blend(np.clip(mask, 0, 1), color, alpha)

    def rain(self, color=MOON, alpha=0.16, seed=0, count=260, slant=0.06) -> None:
        rng = np.random.default_rng(seed)

        def draw(d):
            for _ in range(count):
                x, y = rng.uniform(-0.05, 1.05), rng.uniform(-0.05, 1.0)
                ln = rng.uniform(0.02, 0.06)
                d.line([(x * self.w, y * self.h), ((x + slant * ln * 8) * self.w, (y + ln) * self.h)],
                       fill=255, width=max(1, int(0.0012 * self.w)))

        self._blend(self._shape(draw, blur=1.0), color, alpha)

    def snowfall(self, color=MOON, alpha=0.5, seed=0, count=240) -> None:
        rng = np.random.default_rng(seed)

        def draw(d):
            for _ in range(count):
                x, y = rng.uniform(0, 1), rng.uniform(0, 1)
                r = rng.uniform(0.0012, 0.0042) * self.w
                d.ellipse([x * self.w - r, y * self.h - r, x * self.w + r, y * self.h + r], fill=255)

        self._blend(self._shape(draw, blur=1.4), color, alpha)

    def smoke(self, x, y_base, y_top, color=MOON, alpha=0.14, seed=0) -> None:
        rng = np.random.default_rng(seed)

        def draw(d):
            px = x
            steps = 26
            for s in range(steps):
                t = s / steps
                py = y_base + (y_top - y_base) * t
                px += rng.uniform(-0.012, 0.012) + 0.004 * math.sin(t * 9)
                r = (0.004 + 0.02 * t) * self.w
                d.ellipse([px * self.w - r, py * self.h - r, px * self.w + r, py * self.h + r], fill=255)

        self._blend(self._shape(draw, blur=6.0), color, alpha)

    def haze(self, color, alpha=0.1) -> None:
        self._blend(np.ones((self.h, self.w), np.float32), color, alpha)

    # -- output --------------------------------------------------------

    def _fractal(self, octaves=5, seed=0) -> np.ndarray:
        rng = np.random.default_rng(seed)
        acc = np.zeros((self.h, self.w), np.float32)
        amp = 1.0
        for o in range(octaves):
            n = 3 * 2 ** o
            base = rng.random((n, max(2, int(n * self.w / self.h)))).astype(np.float32)
            layer = np.asarray(
                Image.fromarray((base * 255).astype(np.uint8)).resize((self.w, self.h), Image.BICUBIC),
                dtype=np.float32) / 255.0
            acc += (layer - 0.5) * amp
            amp *= 0.55
        return acc / 1.9

    def texture(self, strength=0.18, seed=0) -> None:
        n = self._fractal(5, seed)
        self.img = np.clip(self.img * (1.0 + n[..., None] * strength), 0, 255)

    def warp(self, amount=0.004, seed=0) -> None:
        dx = self._fractal(3, seed + 1) * amount * self.w
        dy = self._fractal(3, seed + 2) * amount * self.h
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        sx = np.clip(xx + dx, 0, self.w - 1).astype(np.int32)
        sy = np.clip(yy + dy, 0, self.h - 1).astype(np.int32)
        self.img = self.img[sy, sx]

    def to_image(self) -> Image.Image:
        self.warp(0.005, int(self.rng.integers(0, 10000)))
        self.texture(0.2, int(self.rng.integers(0, 10000)))
        arr = np.clip(self.img, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr, "RGB").resize((W, H), Image.LANCZOS)
        bloom = img.filter(ImageFilter.GaussianBlur(14))
        a = np.asarray(img, dtype=np.float32)
        b = np.asarray(bloom, dtype=np.float32)
        return Image.fromarray(np.clip(a + np.clip(b - 128, 0, None) * 0.38, 0, 255).astype(np.uint8), "RGB")


def finish(img: Image.Image, seed: int, warmth: float = 1.0, dim: float = 1.0) -> Image.Image:
    """Book-wide grade: ink desaturation, silk split-tone, vignette, weave."""

    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    a = a * 0.9 + lum[..., None] * 0.1
    a = np.clip((a - 0.5) * 1.12 + 0.5, 0, 1) * 1.04 * dim + 0.05 * dim

    shadow = np.array([0.40, 0.46, 0.50], dtype=np.float32)   # 黛影
    light = np.array([1.1, 1.02, 0.88], dtype=np.float32)     # 绢光
    t = np.clip(lum * 1.2, 0, 1)[..., None]
    tone = shadow * (1 - t) + light * t
    a = np.clip(a * (1 - 0.3 * warmth) + a * tone * 0.3 * warmth, 0, 1)

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.hypot((xx / W - 0.5) / 0.62, (yy / H - 0.5) / 0.62)
    a *= np.clip(1.04 - 0.22 * r ** 2.2, 0.56, 1.0)[..., None]

    rng = np.random.default_rng(seed)
    grain = rng.normal(0.0, 0.013, (H, W, 1)).astype(np.float32)
    weave_x = np.sin(xx * math.tau / 3.1) * 0.006
    weave_y = np.sin(yy * math.tau / 3.7) * 0.006
    a = np.clip(a + grain + (weave_x + weave_y)[..., None], 0, 1)

    out = Image.fromarray((a * 255).astype(np.uint8), "RGB")
    return out.filter(ImageFilter.UnsharpMask(radius=2, percent=36, threshold=3))


# --------------------------------------------------------------------------
# plates
# --------------------------------------------------------------------------


def p_cover(seed):
    p = Plate((30, 28, 26), SILK_LO, seed)
    p.mist(0.7, 0.3, INK_DAI, 0.2, seed + 1)
    p.peaks(0.98, 0.35, (24, 26, 26), seed + 2, 0.7)
    p.glow(0.5, 0.44, 0.14, MALACHITE, 0.5)
    p.glow(0.5, 0.44, 0.07, (150, 190, 160), 0.55)
    p.ellipse(0.465, 0.375, 0.535, 0.505, (120, 170, 138), 0.5, blur=8)
    p.glow(0.5, 0.42, 0.02, MOON, 0.5)
    p.blossoms(40, (104, 92, 68), seed + 3, (0.75, 1.0), 0.004, 0.34)
    p.line(0.5, 0.505, 0.5, 0.62, ROUGE, 0.003, 0.5, 2)
    p.rect(0.86, 0.78, 0.895, 0.85, ROUGE, 0.5, blur=2)
    return p


def p_qinggeng(seed):
    p = Plate((40, 42, 44), SILK_LO, seed)
    p.peaks(0.86, 0.62, (30, 36, 40), seed + 1, 0.85)
    p.peaks(0.92, 0.4, (24, 28, 32), seed + 2, 0.95)
    p.mist(0.62, 0.16, MOON, 0.14, seed + 3)
    p.mist(0.84, 0.1, MOON, 0.1, seed + 4)
    p.glow(0.62, 0.78, 0.07, MALACHITE, 0.6)
    p.glow(0.62, 0.78, 0.026, (178, 218, 188), 0.7)
    p.band(0.12, 0.1, INK_DAI, 0.3)
    return p


def p_taixu(seed):
    p = Plate((56, 60, 66), (26, 26, 30), seed)
    p.mist(0.75, 0.3, MOON, 0.2, seed + 1)
    p.mist(0.5, 0.2, (150, 160, 170), 0.16, seed + 2)
    p.glow(0.5, 0.3, 0.3, (120, 130, 150), 0.28)
    p.glow(0.5, 0.28, 0.12, MOON, 0.3)
    p.rect(0.44, 0.34, 0.445, 0.62, MOON, 0.28, blur=4)
    p.rect(0.555, 0.34, 0.56, 0.62, MOON, 0.28, blur=4)
    p.rect(0.42, 0.32, 0.58, 0.345, MOON, 0.3, blur=4)
    p.mist(0.9, 0.14, (170, 178, 188), 0.2, seed + 3)
    return p


def p_gusu(seed):
    p = Plate((52, 46, 40), SILK_LO, seed)
    p.band(0.3, 0.2, (120, 100, 70), 0.14)
    p.rect(0.05, 0.465, 0.42, 0.64, (168, 158, 138), 0.5, blur=5)
    p.rect(0.5, 0.505, 0.98, 0.66, (150, 142, 124), 0.44, blur=5)
    p.roofline(0.46, 0.05, 0.42, 0.05, (26, 22, 20), 0.95)
    p.roofline(0.5, 0.5, 0.98, 0.06, (24, 20, 18), 0.95)
    p.water(0.7, AZURITE, 0.26, seed + 1)
    p.glow(0.3, 0.55, 0.03, GOLD, 0.5)
    p.glow(0.74, 0.58, 0.025, GOLD, 0.4)
    p.mist(0.66, 0.08, MOON, 0.1, seed + 2)
    return p


def p_study(seed):
    p = Plate((54, 46, 36), SILK_LO, seed)
    p.rect(0.06, 0.1, 0.3, 0.7, (36, 30, 26), 0.7, blur=14)
    p.rect(0.09, 0.2, 0.27, 0.24, (80, 66, 48), 0.4, blur=6)
    p.rect(0.09, 0.4, 0.27, 0.44, (80, 66, 48), 0.4, blur=6)
    p.rect(0.09, 0.58, 0.27, 0.62, (80, 66, 48), 0.4, blur=6)
    p.rect(0.55, 0.18, 0.62, 0.66, PAPER, 0.16, blur=8)
    p.rect(0.66, 0.22, 0.72, 0.62, PAPER, 0.12, blur=8)
    p.rect(0.3, 0.72, 0.95, 0.78, (60, 48, 38), 0.7, blur=10)
    p.glow(0.45, 0.6, 0.09, GOLD, 0.55)
    p.glow(0.45, 0.6, 0.035, (240, 208, 150), 0.5)
    return p


def p_journey(seed):
    p = Plate((48, 50, 52), SILK_LO, seed)
    p.ridge(0.52, 0.1, (36, 44, 50), seed + 1, 0.8)
    p.mist(0.5, 0.1, MOON, 0.16, seed + 2)
    p.water(0.56, (86, 118, 138), 0.3, seed + 3)
    p.glow(0.4, 0.2, 0.05, MOON, 0.4)
    p.glow(0.4, 0.72, 0.05, (150, 164, 172), 0.2, aspect=0.35)
    p.poly([(0.6, 0.7), (0.78, 0.7), (0.75, 0.66), (0.63, 0.66)], (22, 20, 18), 0.9, 3)
    p.rect(0.685, 0.56, 0.692, 0.66, (22, 20, 18), 0.85, 2)
    p.glow(0.69, 0.68, 0.02, GOLD, 0.4)
    p.band(0.16, 0.12, INK_DAI, 0.24)
    return p


def p_capital(seed):
    p = Plate((46, 42, 40), SILK_LO, seed)
    p.band(0.34, 0.2, (110, 96, 74), 0.18)
    p.rect(0.3, 0.3, 0.325, 0.72, (30, 25, 22), 0.95, 2.4)
    p.rect(0.675, 0.3, 0.7, 0.72, (30, 25, 22), 0.95, 2.4)
    p.roofline(0.3, 0.24, 0.76, 0.07, (24, 20, 18), 0.95)
    p.roofline(0.4, 0.4, 0.6, 0.04, (28, 24, 22), 0.85)
    p.rect(0.42, 0.33, 0.58, 0.38, GOLD, 0.16, blur=5)
    p.lantern_row(0.55, 5, (222, 150, 70), seed + 1, 0.16, 0.84, 0.014, 0.4)
    p.rect(-0.02, 0.72, 1.02, 1.02, (30, 26, 24), 0.85, blur=18)
    p.mist(0.25, 0.1, INK_DAI, 0.2, seed + 2)
    return p


def p_ronghall(seed):
    p = Plate((56, 46, 34), (22, 18, 15), seed)
    p.columns(4, 0.14, 0.86, 0.12, 0.78, (34, 26, 22), 0.85)
    p.rect(0.36, 0.14, 0.64, 0.24, (70, 54, 36), 0.5, blur=8)
    p.rect(0.38, 0.155, 0.62, 0.225, GOLD, 0.2, blur=5)
    p.rect(-0.02, 0.78, 1.02, 1.02, (44, 34, 26), 0.9, blur=16)
    p.band(0.8, 0.05, GOLD, 0.1)
    p.glow(0.26, 0.6, 0.05, (230, 170, 90), 0.4)
    p.glow(0.74, 0.6, 0.05, (230, 170, 90), 0.4)
    p.glow(0.5, 0.2, 0.2, (140, 110, 70), 0.2)
    return p


def p_jiamu(seed):
    p = Plate((62, 50, 38), (26, 21, 17), seed)
    p.rect(0.06, 0.12, 0.34, 0.7, (44, 34, 26), 0.7, blur=12)
    p.rect(0.66, 0.12, 0.94, 0.7, (44, 34, 26), 0.7, blur=12)
    p.rect(0.37, 0.2, 0.63, 0.66, (78, 60, 42), 0.4, blur=10)
    p.glow(0.5, 0.44, 0.16, (220, 170, 100), 0.34)
    p.glow(0.24, 0.58, 0.05, (240, 190, 110), 0.5)
    p.glow(0.76, 0.58, 0.05, (240, 190, 110), 0.5)
    p.rect(-0.02, 0.7, 1.02, 1.02, (40, 31, 24), 0.9, blur=16)
    p.blossoms(16, ROUGE, seed + 2, (0.16, 0.3), 0.004, 0.2)
    return p


def p_neiyuan(seed):
    p = Plate((50, 44, 38), SILK_LO, seed)
    p.roofline(0.26, 0.1, 0.9, 0.06, (24, 20, 18), 0.9)
    p.lattice(0.36, 0.34, 0.64, 0.62, (30, 24, 20), (196, 150, 86), seed, (6, 4), 0.5)
    p.rect(0.1, 0.3, 0.32, 0.66, (34, 28, 24), 0.6, blur=10)
    p.rect(0.68, 0.3, 0.9, 0.66, (34, 28, 24), 0.6, blur=10)
    p.rect(-0.02, 0.66, 1.02, 1.02, (32, 27, 23), 0.9, blur=14)
    p.mist(0.2, 0.08, INK_DAI, 0.18, seed + 1)
    return p


def p_lixiang(seed):
    p = Plate((48, 44, 40), SILK_LO, seed)
    p.rect(0.05, 0.3, 0.95, 0.68, (60, 54, 46), 0.35, blur=12)
    p.ellipse(0.38, 0.3, 0.62, 0.74, (30, 27, 24), 0.85, blur=3)
    p.ellipse(0.4, 0.34, 0.6, 0.7, (90, 82, 68), 0.4, blur=8)
    p.glow(0.5, 0.52, 0.05, GOLD, 0.3)
    p.blossoms(50, MOON, seed + 1, (0.1, 0.4), 0.004, 0.3)
    p.rect(-0.02, 0.72, 1.02, 1.02, (30, 27, 24), 0.85, blur=14)
    return p


def p_ningfu(seed):
    p = Plate((44, 44, 48), (20, 19, 20), seed)
    p.columns(5, 0.1, 0.9, 0.14, 0.76, (28, 26, 26), 0.85)
    p.rect(0.34, 0.16, 0.66, 0.25, (54, 50, 48), 0.4, blur=8)
    p.glow(0.5, 0.5, 0.2, (110, 116, 128), 0.2)
    p.glow(0.5, 0.62, 0.06, (200, 160, 100), 0.28)
    p.rect(-0.02, 0.76, 1.02, 1.02, (28, 27, 27), 0.9, blur=16)
    p.mist(0.16, 0.1, INK_DAI, 0.22, seed + 1)
    return p


def p_qinroom(seed):
    p = Plate((60, 44, 42), (26, 19, 18), seed)
    p.poly([(0.2, 0.1), (0.8, 0.1), (0.72, 0.7), (0.28, 0.7)], (46, 30, 30), 0.55, 20)
    p.poly([(0.24, 0.12), (0.4, 0.12), (0.34, 0.68), (0.26, 0.68)], (96, 56, 56), 0.35, 14)
    p.poly([(0.6, 0.12), (0.76, 0.12), (0.74, 0.68), (0.66, 0.68)], (96, 56, 56), 0.35, 14)
    p.glow(0.5, 0.4, 0.13, (210, 140, 110), 0.3)
    p.smoke(0.78, 0.72, 0.24, MOON, 0.12, seed + 1)
    p.rect(-0.02, 0.7, 1.02, 1.02, (36, 26, 24), 0.9, blur=16)
    p.glow(0.3, 0.62, 0.035, GOLD, 0.4)
    return p


def p_school(seed):
    p = Plate((52, 46, 38), SILK_LO, seed)
    p.lattice(0.62, 0.16, 0.92, 0.5, (30, 26, 22), (150, 132, 96), seed, (5, 3), 0.4)
    p.rect(0.08, 0.6, 0.36, 0.66, (60, 48, 36), 0.6, blur=6)
    p.rect(0.14, 0.7, 0.42, 0.76, (56, 44, 34), 0.6, blur=6)
    p.rect(0.2, 0.8, 0.48, 0.86, (52, 42, 32), 0.6, blur=6)
    p.rect(0.1, 0.55, 0.2, 0.6, PAPER, 0.2, blur=4)
    p.glow(0.75, 0.33, 0.1, (200, 180, 130), 0.25)
    return p


def p_court(seed):
    p = Plate((48, 48, 50), (20, 20, 21), seed)
    p.rect(0.28, 0.44, 0.72, 0.6, (36, 34, 33), 0.9, blur=6)
    p.rect(0.3, 0.36, 0.7, 0.45, (78, 70, 60), 0.6, blur=5)
    p.rect(0.38, 0.24, 0.62, 0.32, (64, 60, 54), 0.5, blur=6)
    p.glow(0.5, 0.08, 0.34, (170, 170, 162), 0.3, aspect=2.4)
    p.columns(2, 0.14, 0.86, 0.1, 0.8, (26, 25, 26), 0.9)
    p.rect(-0.02, 0.74, 1.02, 1.02, (28, 27, 27), 0.9, blur=14)
    p.band(0.85, 0.04, (90, 88, 84), 0.12)
    return p


def p_daoxiang(seed):
    p = Plate((56, 50, 38), SILK_LO, seed)
    p.ridge(0.5, 0.08, (36, 36, 30), seed + 1, 0.7)
    p.poly([(0.56, 0.5), (0.66, 0.36), (0.88, 0.36), (0.96, 0.5)], (30, 25, 20), 0.95, 3)
    p.rect(0.6, 0.5, 0.92, 0.62, (44, 36, 28), 0.85, 4)
    p.glow(0.73, 0.56, 0.03, GOLD, 0.5)
    for i in range(6):
        y = 0.68 + i * 0.055
        p.line(0.02, y, 0.55, y + 0.02, (60, 56, 40), 0.0035, 0.4, 2.2)
    p.mist(0.48, 0.06, MOON, 0.1, seed + 2)
    p.blossoms(20, GOLD, seed + 3, (0.55, 0.62), 0.003, 0.25)
    return p


def p_tiejian(seed):
    p = Plate((42, 44, 46), SILK_LO, seed)
    p.peaks(0.8, 0.5, (28, 32, 34), seed + 1, 0.9)
    p.roofline(0.42, 0.38, 0.62, 0.05, (22, 22, 22), 0.95)
    p.rect(0.44, 0.42, 0.6, 0.52, (36, 34, 32), 0.8, 4)
    p.glow(0.52, 0.47, 0.02, GOLD, 0.45)
    for i in range(4):
        x = 0.12 + i * 0.06
        p.poly([(x, 0.62), (x + 0.015, 0.5 - i * 0.01), (x + 0.03, 0.62)], (24, 30, 26), 0.8, 2.4)
    p.mist(0.58, 0.1, MOON, 0.14, seed + 2)
    p.smoke(0.53, 0.42, 0.2, MOON, 0.1, seed + 3)
    return p


def p_temple(seed):
    p = Plate((50, 46, 40), SILK_LO, seed)
    p.roofline(0.32, 0.16, 0.84, 0.07, (26, 23, 20), 0.92)
    p.columns(3, 0.24, 0.76, 0.36, 0.72, (32, 27, 23), 0.8)
    p.smoke(0.4, 0.7, 0.2, MOON, 0.14, seed + 1)
    p.smoke(0.6, 0.7, 0.22, MOON, 0.12, seed + 2)
    p.glow(0.5, 0.55, 0.06, (220, 160, 90), 0.35)
    p.rect(-0.02, 0.72, 1.02, 1.02, (34, 30, 26), 0.88, blur=14)
    p.rect(0.42, 0.36, 0.58, 0.42, GOLD, 0.15, blur=5)
    return p


def p_shengqin(seed):
    p = Plate((40, 26, 26), (18, 13, 13), seed)
    p.roofline(0.3, 0.1, 0.9, 0.08, (26, 18, 16), 0.95)
    p.roofline(0.2, 0.3, 0.7, 0.05, (22, 15, 14), 0.9)
    p.lantern_row(0.44, 7, (240, 160, 80), seed + 1, 0.1, 0.9, 0.016, 0.55)
    p.lantern_row(0.58, 9, (230, 140, 70), seed + 2, 0.06, 0.94, 0.012, 0.4)
    p.band(0.75, 0.2, (120, 60, 40), 0.2)
    p.glow(0.5, 0.34, 0.3, (180, 90, 50), 0.18)
    p.rect(-0.02, 0.78, 1.02, 1.02, (26, 18, 16), 0.9, blur=16)
    return p


def p_daguan_spring(seed):
    p = Plate((52, 54, 44), SILK_LO, seed)
    p.ridge(0.56, 0.1, (34, 42, 36), seed + 1, 0.75)
    p.ellipse(0.3, 0.52, 0.7, 0.62, (34, 40, 36), 0.6, blur=8)
    p.ellipse(0.34, 0.53, 0.66, 0.58, (172, 172, 150), 0.22, blur=8)
    for i in range(7):
        x = 0.08 + i * 0.13
        p.line(x, 0.2, x + 0.02, 0.55, (40, 52, 42), 0.0025, 0.5, 2)
        for s in range(4):
            p.line(x + 0.02 * s / 4, 0.24 + s * 0.07, x - 0.03, 0.4 + s * 0.08, (56, 76, 56), 0.0018, 0.4, 1.6)
    p.blossoms(90, (188, 122, 122), seed + 2, (0.15, 0.5), 0.0045, 0.42)
    p.water(0.62, MALACHITE, 0.14, seed + 3)
    p.mist(0.5, 0.08, MOON, 0.1, seed + 4)
    return p


def p_daguan_summer(seed):
    p = Plate((46, 56, 48), (18, 21, 18), seed)
    p.glow(0.78, 0.16, 0.06, MOON, 0.4)
    p.water(0.5, (60, 104, 86), 0.32, seed + 1)
    for i in range(9):
        rng = np.random.default_rng(seed + 10 + i)
        x, y = rng.uniform(0.1, 0.9), rng.uniform(0.58, 0.9)
        r = rng.uniform(0.02, 0.05)
        p.ellipse(x - r, y - r * 0.4, x + r, y + r * 0.4, (34, 52, 40), 0.9, 3)
        p.ellipse(x - r * 0.9, y - r * 0.42, x + r * 0.6, y - r * 0.1, (66, 96, 74), 0.5, 3)
    p.blossoms(6, (190, 120, 130), seed + 2, (0.55, 0.8), 0.006, 0.5)
    p.ridge(0.4, 0.08, (26, 34, 30), seed + 3, 0.8)
    p.branch(0.0, 0.08, 0.4, 0.18, (24, 30, 26), seed + 4, 0.85, 8)
    p.mist(0.36, 0.06, MOON, 0.08, seed + 5)
    return p


def p_daguan_autumn(seed):
    p = Plate((54, 46, 36), SILK_LO, seed)
    p.ridge(0.52, 0.09, (38, 34, 26), seed + 1, 0.75)
    for i in range(14):
        rng = np.random.default_rng(seed + 20 + i)
        x = rng.uniform(0.04, 0.96)
        p.line(x, 0.72, x + rng.uniform(-0.03, 0.03), 0.52, (70, 60, 40), 0.0022, 0.45, 1.6)
        p.ellipse(x - 0.008, 0.5, x + 0.024, 0.53, (110, 92, 56), 0.3, 2.4)
    p.blossoms(40, GOLD, seed + 2, (0.6, 0.8), 0.004, 0.28)
    p.water(0.78, (60, 66, 60), 0.12, seed + 3)
    p.band(0.2, 0.14, (110, 88, 56), 0.12)
    p.mist(0.5, 0.07, MOON, 0.09, seed + 4)
    return p


def p_xiaoxiang(seed):
    p = Plate((38, 46, 42), (16, 18, 17), seed)
    p.lattice(0.58, 0.3, 0.86, 0.6, (26, 28, 26), (170, 150, 100), seed, (5, 3), 0.4)
    rng = np.random.default_rng(seed + 1)
    for i in range(9):
        x = 0.06 + i * 0.055 + rng.uniform(-0.012, 0.012)
        p.bamboo(x, 0.06, 0.95, rng.uniform(-0.06, 0.06), (30, 44, 36), seed + 30 + i, 0.75)
    for i in range(5):
        x = 0.55 + i * 0.1
        p.bamboo(x, 0.02, 1.0, rng.uniform(-0.08, 0.08), (22, 30, 26), seed + 50 + i, 0.9, 0.005)
    p.mist(0.85, 0.1, INK_PINE, 0.2, seed + 2)
    return p


def p_yihong(seed):
    p = Plate((58, 40, 36), (24, 17, 15), seed)
    p.branch(0.05, 0.16, 0.6, 0.3, (34, 24, 22), seed + 1, 0.9, 9)
    p.blossoms(60, (196, 100, 100), seed + 2, (0.1, 0.4), 0.006, 0.42)
    p.blossoms(30, (230, 150, 140), seed + 3, (0.12, 0.38), 0.004, 0.3)
    p.lattice(0.6, 0.36, 0.9, 0.66, (32, 24, 22), (210, 130, 80), seed, (5, 3), 0.45)
    p.glow(0.28, 0.62, 0.035, (245, 170, 90), 0.55)
    p.glow(0.4, 0.66, 0.028, (245, 160, 80), 0.45)
    p.rect(-0.02, 0.72, 1.02, 1.02, (34, 25, 22), 0.88, blur=14)
    return p


def p_hengwu(seed):
    p = Plate((48, 48, 44), (19, 19, 18), seed)
    p.rect(0.3, 0.3, 0.7, 0.62, (66, 66, 60), 0.25, blur=14)
    rng = np.random.default_rng(seed + 1)
    for _ in range(4):
        x = rng.uniform(0.06, 0.9)
        h_ = rng.uniform(0.12, 0.3)
        p.poly([(x, 0.78), (x + 0.03, 0.78 - h_), (x + 0.07, 0.78 - h_ * 0.5), (x + 0.1, 0.78)],
               (30, 32, 30), 0.85, 3)
    p.blossoms(30, (120, 130, 100), seed + 2, (0.55, 0.75), 0.003, 0.3)
    p.rect(-0.02, 0.76, 1.02, 1.02, (28, 28, 26), 0.9, blur=14)
    p.glow(0.5, 0.44, 0.1, (170, 170, 150), 0.16)
    p.smoke(0.64, 0.7, 0.3, MOON, 0.08, seed + 3)
    return p


def p_qiushuang(seed):
    p = Plate((54, 48, 38), SILK_LO, seed)
    p.lattice(0.1, 0.16, 0.5, 0.56, (32, 27, 22), (176, 152, 104), seed, (7, 4), 0.42)
    for i in range(3):
        rng = np.random.default_rng(seed + 5 + i)
        x = 0.62 + i * 0.1
        p.poly([(x, 0.7), (x + 0.02, 0.3 + rng.uniform(-0.05, 0.05)), (x + 0.1, 0.42), (x + 0.06, 0.72)],
               (36, 46, 34), 0.7, 5)
    p.rect(0.08, 0.66, 0.56, 0.74, (58, 46, 34), 0.7, blur=8)
    p.rect(0.12, 0.62, 0.24, 0.66, PAPER, 0.2, blur=4)
    p.rect(-0.02, 0.76, 1.02, 1.02, (32, 28, 24), 0.88, blur=14)
    return p


def p_shuixie(seed):
    p = Plate((44, 48, 48), (17, 18, 18), seed)
    p.water(0.5, AZURITE, 0.22, seed + 1)
    p.rect(0.1, 0.34, 0.9, 0.36, (28, 26, 24), 0.85, 2)
    p.columns(5, 0.12, 0.88, 0.36, 0.52, (26, 24, 22), 0.85)
    p.rect(0.08, 0.52, 0.92, 0.545, (28, 26, 24), 0.85, 2)
    p.roofline(0.34, 0.06, 0.94, 0.06, (24, 22, 20), 0.92)
    for i in range(6):
        rng = np.random.default_rng(seed + 10 + i)
        x, y = rng.uniform(0.12, 0.88), rng.uniform(0.66, 0.9)
        r = rng.uniform(0.018, 0.04)
        p.ellipse(x - r, y - r * 0.36, x + r, y + r * 0.36, (28, 40, 34), 0.75, 2.6)
    p.glow(0.5, 0.44, 0.05, (220, 180, 110), 0.3)
    return p


def p_flowermound(seed):
    p = Plate((52, 46, 44), SILK_LO, seed)
    p.ridge(0.6, 0.12, (38, 34, 32), seed + 1, 0.7)
    p.branch(0.98, 0.1, 0.5, 0.26, (30, 24, 22), seed + 2, 0.9, 10)
    p.blossoms(120, (188, 120, 122), seed + 3, (0.08, 0.6), 0.005, 0.36)
    p.blossoms(70, (220, 160, 150), seed + 4, (0.5, 0.9), 0.0045, 0.3)
    p.water(0.72, (70, 76, 78), 0.16, seed + 5)
    p.mist(0.56, 0.08, MOON, 0.1, seed + 6)
    return p


def p_luxue(seed):
    p = Plate((60, 60, 62), (26, 26, 28), seed)
    p.band(0.7, 0.3, (170, 172, 168), 0.3)
    p.ridge(0.62, 0.08, (120, 122, 120), seed + 1, 0.5, blur=5)
    p.poly([(0.14, 0.56), (0.24, 0.44), (0.44, 0.44), (0.52, 0.56)], (40, 36, 32), 0.9, 3)
    p.rect(0.18, 0.56, 0.48, 0.66, (52, 44, 36), 0.85, 4)
    p.glow(0.33, 0.6, 0.03, GOLD, 0.5)
    p.branch(0.95, 0.24, 0.6, 0.4, (36, 28, 26), seed + 2, 0.9, 8)
    p.blossoms(46, ROUGE, seed + 3, (0.2, 0.5), 0.0045, 0.55)
    p.snowfall(MOON, 0.4, seed + 4, 200)
    return p


def p_longcui(seed):
    p = Plate((46, 48, 50), (20, 21, 22), seed)
    p.roofline(0.34, 0.2, 0.8, 0.06, (26, 26, 26), 0.9)
    p.rect(0.4, 0.38, 0.6, 0.6, (34, 32, 30), 0.75, 6)
    p.glow(0.5, 0.5, 0.025, GOLD, 0.4)
    p.branch(0.02, 0.7, 0.55, 0.3, (30, 26, 24), seed + 1, 0.95, 12)
    p.blossoms(60, (186, 84, 84), seed + 2, (0.24, 0.62), 0.005, 0.55)
    p.band(0.85, 0.14, (150, 152, 150), 0.22)
    p.snowfall(MOON, 0.3, seed + 3, 150)
    p.smoke(0.56, 0.38, 0.16, MOON, 0.1, seed + 4)
    return p


def p_moonpav(seed):
    p = Plate((34, 38, 46), (14, 15, 18), seed)
    p.glow(0.64, 0.22, 0.13, MOON, 0.5)
    p.glow(0.64, 0.22, 0.05, (244, 244, 232), 0.9)
    p.water(0.5, (92, 110, 124), 0.3, seed + 1)
    p.glow(0.64, 0.7, 0.06, (200, 208, 206), 0.3, aspect=0.32)
    p.glow(0.64, 0.85, 0.05, (170, 180, 182), 0.2, aspect=0.4)
    p.rect(0.06, 0.56, 0.44, 0.578, (24, 26, 28), 0.9, 2)
    p.columns(3, 0.08, 0.42, 0.44, 0.56, (22, 24, 26), 0.9)
    p.roofline(0.42, 0.05, 0.45, 0.05, (20, 22, 24), 0.92)
    p.mist(0.4, 0.08, (130, 140, 150), 0.14, seed + 2)
    return p


def p_banquet(seed):
    p = Plate((52, 38, 30), (22, 16, 14), seed)
    p.lantern_row(0.3, 6, (240, 160, 80), seed + 1, 0.12, 0.88, 0.02, 0.5)
    p.lantern_row(0.42, 8, (235, 150, 75), seed + 2, 0.08, 0.92, 0.014, 0.4)
    p.rect(0.1, 0.62, 0.9, 0.68, (66, 48, 32), 0.6, blur=8)
    p.rect(0.16, 0.72, 0.84, 0.78, (60, 44, 30), 0.6, blur=8)
    p.glow(0.5, 0.55, 0.3, (190, 120, 60), 0.16)
    p.columns(2, 0.06, 0.94, 0.1, 0.8, (30, 22, 18), 0.8)
    p.rect(-0.02, 0.8, 1.02, 1.02, (30, 22, 18), 0.9, blur=14)
    return p


def p_raid(seed):
    p = Plate((30, 30, 34), (12, 12, 14), seed)
    for i in range(4):
        t = i / 3
        x0 = 0.18 + t * 0.22
        x1 = 0.82 - t * 0.22
        y0 = 0.14 + t * 0.1
        y1 = 0.86 - t * 0.06
        p.rect(x0, y0, x0 + 0.012, y1, (46, 48, 54), 0.5 - t * 0.08, 3)
        p.rect(x1 - 0.012, y0, x1, y1, (46, 48, 54), 0.5 - t * 0.08, 3)
        p.rect(x0, y0, x1, y0 + 0.014, (46, 48, 54), 0.45 - t * 0.08, 3)
    p.glow(0.5, 0.52, 0.05, (150, 170, 190), 0.3)
    p.rect(-0.02, 0.86, 1.02, 1.02, (18, 18, 20), 0.9, blur=12)
    p.mist(0.2, 0.1, (40, 44, 52), 0.3, seed + 1)
    return p


def p_mourning(seed):
    p = Plate((56, 56, 54), (24, 24, 23), seed)
    for i in range(6):
        x = 0.1 + i * 0.15
        p.rect(x, 0.08, x + 0.07, 0.7, (170, 170, 162), 0.16, blur=6)
    p.rect(0.4, 0.3, 0.6, 0.5, (40, 40, 38), 0.5, blur=10)
    p.glow(0.42, 0.6, 0.025, (235, 200, 140), 0.5)
    p.glow(0.58, 0.6, 0.025, (235, 200, 140), 0.5)
    p.smoke(0.5, 0.6, 0.2, MOON, 0.1, seed + 1)
    p.rect(-0.02, 0.72, 1.02, 1.02, (30, 30, 29), 0.9, blur=14)
    return p


def p_snowend(seed):
    p = Plate((88, 90, 94), (150, 152, 150), seed)
    p.band(0.2, 0.2, (70, 74, 80), 0.4)
    p.mist(0.42, 0.1, (200, 202, 200), 0.3, seed + 1)
    p.band(0.75, 0.3, (188, 190, 186), 0.5)
    p.poly([(0.62, 0.62), (0.632, 0.53), (0.644, 0.62)], (40, 38, 40), 0.9, 2)
    p.ellipse(0.615, 0.6, 0.65, 0.63, (44, 42, 44), 0.7, 2)
    p.ridge(0.6, 0.05, (140, 144, 146), seed + 2, 0.5, blur=5)
    p.snowfall((240, 240, 238), 0.5, seed + 3, 260)
    return p


def p_palace(seed):
    p = Plate((44, 30, 30), (18, 13, 13), seed)
    p.poly([(0.05, 0.08), (0.3, 0.08), (0.26, 0.75), (0.05, 0.75)], (74, 36, 36), 0.5, 16)
    p.poly([(0.7, 0.08), (0.95, 0.08), (0.95, 0.75), (0.74, 0.75)], (74, 36, 36), 0.5, 16)
    p.glow(0.5, 0.36, 0.16, (200, 150, 90), 0.24)
    p.rect(0.42, 0.3, 0.58, 0.56, (58, 40, 32), 0.5, blur=10)
    p.rect(0.44, 0.26, 0.56, 0.31, GOLD, 0.18, blur=5)
    p.smoke(0.34, 0.7, 0.3, MOON, 0.08, seed + 1)
    p.rect(-0.02, 0.74, 1.02, 1.02, (30, 21, 20), 0.9, blur=14)
    return p


def p_commonhouse(seed):
    p = Plate((46, 42, 38), SILK_LO, seed)
    p.roofline(0.36, 0.12, 0.66, 0.04, (26, 22, 20), 0.9)
    p.rect(0.18, 0.36, 0.62, 0.68, (40, 34, 28), 0.6, blur=8)
    p.lattice(0.3, 0.44, 0.5, 0.62, (28, 24, 20), (170, 130, 80), seed, (3, 2), 0.4)
    p.rect(0.72, 0.3, 0.98, 0.72, (30, 27, 24), 0.7, blur=10)
    p.rect(-0.02, 0.7, 1.02, 1.02, (30, 26, 23), 0.9, blur=12)
    p.mist(0.24, 0.08, INK_DAI, 0.16, seed + 1)
    return p


def p_rain_autumn(seed):
    p = Plate((34, 38, 40), (14, 15, 16), seed)
    p.lattice(0.32, 0.3, 0.68, 0.64, (24, 24, 22), (188, 150, 92), seed, (6, 4), 0.5)
    p.glow(0.5, 0.47, 0.13, (210, 160, 90), 0.22)
    rng = np.random.default_rng(seed + 1)
    for i in range(4):
        x = 0.04 + i * 0.05
        p.bamboo(x, 0.1, 0.98, rng.uniform(-0.05, 0.02), (24, 32, 28), seed + 20 + i, 0.7)
    for i in range(3):
        x = 0.82 + i * 0.06
        p.bamboo(x, 0.12, 1.0, rng.uniform(-0.02, 0.05), (24, 32, 28), seed + 40 + i, 0.7)
    p.rain(MOON, 0.14, seed + 2, 300, 0.05)
    p.mist(0.85, 0.12, (60, 66, 64), 0.3, seed + 3)
    return p


PLATES = {
    "cover": (p_cover, 101, 0.9),
    "qinggeng": (p_qinggeng, 102, 0.8),
    "taixu": (p_taixu, 103, 0.6),
    "gusu": (p_gusu, 104, 1.0),
    "study": (p_study, 105, 1.1),
    "journey": (p_journey, 106, 0.8),
    "capital": (p_capital, 107, 1.0),
    "ronghall": (p_ronghall, 108, 1.15),
    "jiamu": (p_jiamu, 109, 1.15),
    "neiyuan": (p_neiyuan, 110, 1.05),
    "lixiang": (p_lixiang, 111, 0.95),
    "ningfu": (p_ningfu, 112, 0.7),
    "qinroom": (p_qinroom, 113, 1.1),
    "school": (p_school, 114, 1.0),
    "court": (p_court, 115, 0.7),
    "daoxiang": (p_daoxiang, 116, 1.0),
    "tiejian": (p_tiejian, 117, 0.8),
    "temple": (p_temple, 118, 0.95),
    "shengqin": (p_shengqin, 119, 1.2),
    "daguan_spring": (p_daguan_spring, 120, 0.9),
    "daguan_summer": (p_daguan_summer, 121, 0.8),
    "daguan_autumn": (p_daguan_autumn, 122, 1.05),
    "xiaoxiang": (p_xiaoxiang, 123, 0.75),
    "yihong": (p_yihong, 124, 1.15),
    "hengwu": (p_hengwu, 125, 0.8),
    "qiushuang": (p_qiushuang, 126, 1.05),
    "shuixie": (p_shuixie, 127, 0.85),
    "flowermound": (p_flowermound, 128, 0.95),
    "luxue": (p_luxue, 129, 0.8),
    "longcui": (p_longcui, 130, 0.8),
    "moonpav": (p_moonpav, 131, 0.65),
    "banquet": (p_banquet, 132, 1.2),
    "raid": (p_raid, 133, 0.6),
    "mourning": (p_mourning, 134, 0.75),
    "snowend": (p_snowend, 135, 0.7),
    "palace": (p_palace, 136, 1.1),
    "commonhouse": (p_commonhouse, 137, 1.0),
    "rain_autumn": (p_rain_autumn, 138, 0.85),
}


def main() -> None:
    out_dir = Path("books/local/hongloumeng/assets/backgrounds")
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, (fn, seed, warmth) in PLATES.items():
        finish(fn(seed).to_image(), seed, warmth).save(
            out_dir / f"{name}.jpg", quality=87, subsampling=1, optimize=True, progressive=True
        )
        print("drew", name)


if __name__ == "__main__":
    main()
